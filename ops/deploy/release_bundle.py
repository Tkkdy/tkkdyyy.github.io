"""Static-only artifact validation; never runs code from the artifact."""
import hashlib,io,json,re,stat,urllib.parse,zipfile
from html.parser import HTMLParser
from pathlib import Path,PurePosixPath
LIMIT=50_000_000
EXT={'.html','.css','.js','.json','.xml','.txt','.svg','.png','.jpg','.jpeg','.webp','.gif','.ico','.woff','.woff2','.ttf','.webmanifest','.pagefind','.pf_meta','.pf_index','.pf_fragment'}
def sha(b):return hashlib.sha256(b).hexdigest()
def require(ok,msg):
    if not ok:raise ValueError(msg)
def site_origin(value):
    u=urllib.parse.urlsplit(value)
    require(u.scheme=='https' and u.hostname and not u.username and not u.password and u.path in ('','/') and not u.query and not u.fragment,'invalid SITE_URL')
    return value.rstrip('/')
def safe_name(name):
    require(isinstance(name,str) and name and '\\' not in name and '\0' not in name and not name.startswith('/'),'unsafe path')
    require(all(p and p not in ('..','.') and not p.startswith('.') and ':' not in p for p in name.split('/')),'unsafe component')
    require(str(PurePosixPath(name))==name and not re.search(r'[\x00-\x1f\x7f]',name),'noncanonical/control path')
    return name
def release_target(value):
    require(isinstance(value,str) and re.fullmatch(r'releases/[A-Za-z0-9][A-Za-z0-9._-]{0,127}',value),'invalid current target')
    return value
def approve_source(metadata,approved):
    require(metadata['sourceSha'] in approved,'source SHA not explicitly reviewed/approved')

class HTML(HTMLParser):
    def __init__(self):super().__init__();self.canonical=[];self.robots=[];self.refs=[]
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if tag=='link' and d.get('rel')=='canonical':self.canonical.append(d.get('href'))
        if tag=='meta' and d.get('name')=='robots':self.robots.append(d.get('content',''))
        self.refs.extend(d[k] for k in ('href','src','poster') if d.get(k))
def validate_site(data,site):
    site=site_origin(site);require(len(data)>5,'incomplete site')
    for name,body in data.items():
        safe_name(name);p=PurePosixPath(name)
        require(p.parts[0].lower()!='admin' and p.name.lower() not in ('config.yml','config.yaml','package.json','package-lock.json','sveltia.html'),'admin/config exposure')
        require(p.suffix.lower() in EXT,'nonstatic extension '+name)
        require(not re.search(rb'-----BEGIN (?:[A-Z ]*PRIVATE KEY)|github_pat_[A-Za-z0-9_]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|sk-proj-[A-Za-z0-9_-]{30,}',body),'possible secret '+name)
        if p.suffix!='.html':continue
        h=HTML();h.feed(body.decode())
        require(any('noindex' in [x.strip() for x in v.lower().split(',')] for v in h.robots),'missing noindex '+name)
        expected=site+'/'+urllib.parse.quote(name.removesuffix('index.html'),safe='/')
        require(h.canonical==([] if name=='404.html' else [expected]),'canonical '+name)
        for ref in h.refs:
            u=urllib.parse.urlsplit(urllib.parse.urljoin(site+'/'+name,ref))
            require(not re.search(r'(^|/)admin(/|$)',u.path),'admin link')
            if u.scheme not in ('http','https') or u.netloc!=urllib.parse.urlsplit(site).netloc:continue
            target=urllib.parse.unquote(u.path).lstrip('/')
            require(target in data or ((target.rstrip('/')+'/') if target else '')+'index.html' in data,'broken reference '+name+' '+ref)
    for name in ('index.html','404.html','pagefind/pagefind.js','pagefind/pagefind-entry.json','rss.xml','sitemap-index.xml','sitemap-0.xml','robots.txt'):require(name in data,'missing '+name)
    require((site+'/sitemap-index.xml').encode() in data['robots.txt'],'wrong robots')
    import xml.etree.ElementTree as ET
    urls=[x.text for x in ET.fromstring(data['sitemap-0.xml']).iter() if x.tag.endswith('}loc')]
    require(urls and all(u and u.startswith(site+'/') and '/admin' not in u for u in urls),'invalid sitemap')
    links=[x.text for x in ET.fromstring(data['rss.xml']).iter('link')]
    require(links and all(u and u.startswith(site+'/') for u in links),'invalid RSS')
    return {'files':len(data),'html':sum(n.endswith('.html') for n in data),'sitemapUrls':len(urls)}
def load_bundle(raw,digest,site,workflow=None):
    require(len(raw)<=LIMIT and sha(raw)==digest,'bundle size/hash')
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        members=z.infolist();names=[i.filename for i in members]
        require(len(names)==len(set(names)) and len(names)<=5000,'duplicate/excessive entries')
        require(all(not i.is_dir() and not i.flag_bits&1 and not stat.S_ISLNK(i.external_attr>>16) for i in members),'linked/encrypted/directory entry')
        require(sum(i.file_size for i in members)<=LIMIT and all(i.file_size<=8_000_000 for i in members),'expanded ZIP too large')
        require(all(n in ('manifest.json','release.json') or n.startswith('site/') for n in names),'unknown entry')
        for name in names:safe_name(name)
        metadata=json.loads(z.read('release.json'));manifest=json.loads(z.read('manifest.json'))
        require(isinstance(manifest,list) and len(manifest)<=5000,'manifest format')
        data={n[5:]:z.read(n) for n in names if n.startswith('site/')}
        require(len(manifest)==len(data) and len({x['path'] for x in manifest})==len(manifest),'manifest count/duplicates')
        for item in manifest:
            require(safe_name(item['path']) in data,'manifest path')
            b=data[item['path']];require(item['bytes']==len(b) and item['sha256']==sha(b),'file digest/size')
        require(metadata.get('site')==site_origin(site),'site differs')
        for k in ('sourceSha','workflowSha','lockfileSha256','vpsConfigSha256'):
            require(re.fullmatch('[a-f0-9]{40}' if k.endswith('Sha') else '[a-f0-9]{64}',metadata.get(k,'')),'invalid provenance '+k)
        if workflow:require(metadata['workflowSha']==workflow,'unreviewed workflow')
        require(re.fullmatch(r'ci-[a-f0-9]{12}-[0-9]{1,20}-[0-9]{1,3}',metadata.get('releaseId','')),'invalid release ID')
        validate_site(data,site)
        identity=json.loads(data.get('deployment.json',b'{}'))
        require(identity.get('target')=='vps' and identity.get('sourceSha')==metadata['sourceSha'] and identity.get('pipelineSha')==metadata['workflowSha'] and identity.get('lockfileSha256')==metadata['lockfileSha256'] and identity.get('configSha256')==metadata['vpsConfigSha256'],'public version identity differs from trusted pipeline metadata')
        return metadata,manifest,data
def pack(source,output,site,source_sha,workflow_sha,run_id,attempt):
    import subprocess,os
    source=Path(source).resolve();site=site_origin(site)
    require(subprocess.check_output(['git','rev-parse','HEAD'],cwd=source,text=True).strip()==source_sha,'checkout SHA differs')
    require(not subprocess.check_output(['git','status','--porcelain'],cwd=source,text=True).strip(),'dirty checkout')
    dist=source/'dist';require(dist.is_dir() and not dist.is_symlink(),'unsafe dist')
    data={}
    for p in sorted(dist.rglob('*')):
        require(not p.is_symlink(),'linked output')
        if p.is_file():data[p.relative_to(dist).as_posix()]=p.read_bytes()
        else:require(p.is_dir(),'special output')
    validate_site(data,site)
    meta={'releaseId':f'ci-{source_sha[:12]}-{run_id}-{attempt}','site':site,'sourceSha':source_sha,'workflowSha':workflow_sha,'buildCommand':'npm ci && npm run check && npm run build:vps','nodeVersion':'24','lockfileSha256':sha((source/'package-lock.json').read_bytes()),'vpsConfigSha256':sha((source/'astro.config.vps.mjs').read_bytes())}
    manifest=[{'path':n,'bytes':len(b),'sha256':sha(b)} for n,b in sorted(data.items())]
    buffer=io.BytesIO()
    with zipfile.ZipFile(buffer,'w',compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr('manifest.json',json.dumps(manifest,sort_keys=True));z.writestr('release.json',json.dumps(meta,sort_keys=True))
        for n,b in sorted(data.items()):z.writestr('site/'+n,b)
    raw=buffer.getvalue();load_bundle(raw,sha(raw),site)
    with Path(output).open('xb') as f:f.write(raw)
    with Path(str(output)+'.sha256').open('x') as f:f.write(sha(raw)+'\n')
    print(json.dumps({'bundleSha256':sha(raw),**meta}))
if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser()
    for name in ('source','output','site','source-sha','workflow-sha','run-id','attempt'):p.add_argument('--'+name,required=True)
    a=p.parse_args();pack(a.source,a.output,a.site,a.source_sha,a.workflow_sha,a.run_id,a.attempt)
