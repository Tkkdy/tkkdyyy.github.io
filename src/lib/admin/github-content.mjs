const API_ROOT = 'https://api.github.com';

function bytesToBase64(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64ToText(value) {
  const binary = atob(value.replace(/\n/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

export function textToBase64(value) {
  return bytesToBase64(new TextEncoder().encode(value));
}

export function createGitHubClient({ owner, repo, token }) {
  const request = async (path, options = {}) => {
    const response = await fetch(`${API_ROOT}${path}`, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...options.headers,
      },
    });
    if (!response.ok) {
      await response.json().catch(() => ({}));
      const error = new Error(`GitHub 请求失败（${response.status}）。请检查 Token 权限或稍后重试。`);
      error.status = response.status;
      throw error;
    }
    return response.status === 204 ? null : response.json();
  };

  return {
    async authenticate() {
      return request('/user');
    },

    async readFile(path, ref = 'main') {
      try {
        const file = await request(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(ref)}`);
        if (file.type !== 'file' || !file.content) throw new Error(`无法将 ${path} 读取为内容文件。`);
        return { path, sha: file.sha, content: base64ToText(file.content) };
      } catch (error) {
        if (error.status === 404) return null;
        throw error;
      }
    },

    async commitFiles({ branch = 'main', message, files, deletePaths = [] }) {
      const reference = await request(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
      const parentSha = reference.object.sha;
      const parent = await request(`/repos/${owner}/${repo}/git/commits/${parentSha}`);

      const treeEntries = await Promise.all(files.map(async (file) => {
        const blob = await request(`/repos/${owner}/${repo}/git/blobs`, {
          method: 'POST',
          body: JSON.stringify({ content: file.contentBase64, encoding: 'base64' }),
        });
        return { path: file.path, mode: '100644', type: 'blob', sha: blob.sha };
      }));
      treeEntries.push(...deletePaths.map((path) => ({ path, mode: '100644', type: 'blob', sha: null })));

      const tree = await request(`/repos/${owner}/${repo}/git/trees`, {
        method: 'POST',
        body: JSON.stringify({ base_tree: parent.tree.sha, tree: treeEntries }),
      });
      const commit = await request(`/repos/${owner}/${repo}/git/commits`, {
        method: 'POST',
        body: JSON.stringify({ message, tree: tree.sha, parents: [parentSha] }),
      });
      await request(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: commit.sha, force: false }),
      });
      return commit;
    },

    async findWorkflowRun(headSha, branch = 'main') {
      const query = new URLSearchParams({ branch, head_sha: headSha, event: 'push', per_page: '10' });
      const result = await request(`/repos/${owner}/${repo}/actions/runs?${query}`);
      return result.workflow_runs?.[0] ?? null;
    },
  };
}
