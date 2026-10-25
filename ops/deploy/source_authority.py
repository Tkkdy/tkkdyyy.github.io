"""Read-only public GitHub authority. No token, retry, shell, or server mutation."""
import json,re,urllib.request
from release_bundle import require

def github_json(path):
    request=urllib.request.Request('https://api.github.com/repos/'+path,headers={'Accept':'application/vnd.github+json','User-Agent':'restricted-static-deploy','X-GitHub-Api-Version':'2022-11-28'})
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(request,timeout=20) as response:
        require(response.status==200,'GitHub authority unavailable')
        raw=response.read(2_000_001);require(len(raw)<=2_000_000,'authority response too large')
        return json.loads(raw)

def verify_main(repository,source,baseline,fetch=github_json):
    require(re.fullmatch('[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',repository),'invalid repository')
    require(all(re.fullmatch('[a-f0-9]{40}',x or '') for x in [source,baseline]),'invalid source identity')
    current=fetch(repository+'/commits/main')['sha']
    require(current==source,'superseded source: exact main required')
    if source!=baseline:
        compare=fetch(repository+'/compare/'+baseline+'...'+source)
        require(compare.get('status')=='ahead' and compare.get('merge_base_commit',{}).get('sha')==baseline,'source is not a descendant of deployed version')
    return {'sourceSha':source,'previousSha':baseline,'authority':'github-main'}
