"""Static three-target acceptance. Artifacts are tests, not release authorization."""
import argparse,json,urllib.parse
from pathlib import Path
from release_bundle import HTML,require,validate_site,sha

def read(folder):return {p.relative_to(folder).as_posix():p.read_bytes() for p in folder.rglob('*') if p.is_file()}
def audit(folder):
 folder=Path(folder);datasets={name:read(folder/name) for name in ['pages','preview','production']}
 report={'releaseApproved':False,'scope':'ISOLATED_THREE_BUILDS','targets':{}}
 for mode,site in [('preview','https://preview.boenbot.top'),('production','https://tkkdy.me')]:
  report['targets'][mode]=validate_site(datasets[mode],site,mode)
 public={n for n in datasets['pages'] if n.endswith('.html') and not n.startswith('admin/')}
 require(public=={n for n in datasets['preview'] if n.endswith('.html')}=={n for n in datasets['production'] if n.endswith('.html')},'route parity differs')
 require('vps-build.json' not in datasets['pages'],'VPS settings leaked to Pages')
 for n in public:
  parser=HTML();parser.feed(datasets['pages'][n].decode())
  expected='https://tkkdy.github.io/tkkdyyy.github.io/'+urllib.parse.quote(n.removesuffix('index.html'),safe='/')
  require(parser.canonical==([] if n=='404.html' else [expected]),'Pages canonical changed '+n)
  blocked=any('noindex' in x for x in parser.robots)
  require(blocked==(n in ['404.html','search/index.html']),'Pages indexing changed '+n)
 # Compare rendered body text, ignoring metadata/scripts/styles that differ by target.
 from html.parser import HTMLParser
 class Text(HTMLParser):
  def __init__(self):super().__init__();self.body=False;self.skip=0;self.parts=[]
  def handle_starttag(self,tag,attrs):
   if tag=='body':self.body=True
   if tag in ['script','style']:self.skip+=1
  def handle_endtag(self,tag):
   if tag=='body':self.body=False
   if tag in ['script','style']:self.skip-=1
  def handle_data(self,data):
   if self.body and not self.skip:self.parts.append(data)
 for n in public:
  texts=[]
  for mode in ['pages','preview','production']:
   t=Text();t.feed(datasets[mode][n].decode());texts.append(' '.join(' '.join(t.parts).split()))
  require(texts[0]==texts[1]==texts[2],'body content differs between profiles '+n)
 report.update(publicRoutes=len(public),bodyTextParity=True,baselineRssGuids=len(json.loads((Path(__file__).resolve().parents[2]/'src/data/vps-rss-guids.json').read_text())))
 return report
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('directory');p.add_argument('--report',required=True);a=p.parse_args()
 report=audit(a.directory);Path(a.report).write_text(json.dumps(report,indent=2));print(json.dumps(report))
