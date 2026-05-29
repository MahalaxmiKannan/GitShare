import express from 'express';

const router = express.Router();

// Middleware to ensure user is authenticated with GitHub OAuth
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated() && req.user && req.user.accessToken) {
    return next();
  }
  return res.status(401).json({ error: 'Access Denied: You must login via GitHub first to browse repositories.' });
};

// @desc    Get user's GitHub repositories
// @route   GET /github/repos
router.get('/repos', isAuthenticated, async (req, res) => {
  try {
    const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        'Authorization': `token ${req.user.accessToken}`,
        'User-Agent': 'GitShare-App',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ 
        error: errorData.message || 'Error fetching repositories from GitHub' 
      });
    }

    const repos = await response.json();
    
    // Map relevant fields for frontend exploration
    const formattedRepos = repos.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      description: repo.description
    }));

    res.json(formattedRepos);
  } catch (error) {
    console.error('Error fetching GitHub repos:', error);
    res.status(500).json({ error: 'Rate limit hit or connection failed. Please try again later.' });
  }
});

// @desc    Get repository contents (files & folders)
// @route   GET /github/contents
router.get('/contents', isAuthenticated, async (req, res) => {
  try {
    const { repo, path = '' } = req.query;

    if (!repo) {
      return res.status(400).json({ error: 'Repo parameter (owner/name) is required' });
    }

    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      headers: {
        'Authorization': `token ${req.user.accessToken}`,
        'User-Agent': 'GitShare-App',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ 
        error: errorData.message || 'Error fetching repository contents' 
      });
    }

    const contents = await response.json();
    
    if (Array.isArray(contents)) {
      const formattedContents = contents.map(item => ({
        name: item.name,
        path: item.path,
        type: item.type, // 'file' or 'dir'
        size: item.size
      }));
      return res.json(formattedContents);
    } else {
      return res.json({
        name: contents.name,
        path: contents.path,
        type: contents.type,
        size: contents.size
      });
    }
  } catch (error) {
    console.error('Error fetching contents:', error);
    res.status(500).json({ error: 'Failed to load directory contents.' });
  }
});

// @desc    Get raw file content
// @route   GET /github/file-content
router.get('/file-content', isAuthenticated, async (req, res) => {
  try {
    const { repo, path } = req.query;

    if (!repo || !path) {
      return res.status(400).json({ error: 'Repo and path parameters are required' });
    }

    const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      headers: {
        'Authorization': `token ${req.user.accessToken}`,
        'User-Agent': 'GitShare-App',
        'Accept': 'application/vnd.github.v3.raw' // Returns raw text content
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ 
        error: errorText || 'Failed to retrieve file content' 
      });
    }

    const content = await response.text();
    res.json({ content });
  } catch (error) {
    console.error('Error fetching file content:', error);
    res.status(500).json({ error: 'Failed to retrieve file content.' });
  }
});

// @desc    Commit code changes back to GitHub
// @route   POST /github/commit
router.post('/commit', isAuthenticated, async (req, res) => {
  try {
    const { repo, path, code, message = 'Update file via GitShare' } = req.body;

    if (!repo || !path || code === undefined) {
      return res.status(400).json({ error: 'Repo, path, and code parameters are required' });
    }

    // 1. Fetch file metadata first to get the existing blob SHA
    const getResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      headers: {
        'Authorization': `token ${req.user.accessToken}`,
        'User-Agent': 'GitShare-App',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    let sha = null;
    if (getResponse.ok) {
      const fileData = await getResponse.json();
      sha = fileData.sha;
    }

    // 2. Base64 encode the code
    const buffer = Buffer.from(code, 'utf-8');
    const base64Content = buffer.toString('base64');

    // 3. Make PUT request to create/update file
    const body = {
      message,
      content: base64Content
    };
    if (sha) {
      body.sha = sha;
    }

    const putResponse = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${req.user.accessToken}`,
        'User-Agent': 'GitShare-App',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!putResponse.ok) {
      const errorData = await putResponse.json();
      return res.status(putResponse.status).json({ 
        error: errorData.message || 'Error committing changes to GitHub' 
      });
    }

    const result = await putResponse.json();
    res.json({ success: true, commit: result.commit });
  } catch (error) {
    console.error('Error committing to GitHub:', error);
    res.status(500).json({ error: 'Failed to commit changes to GitHub.' });
  }
});

export default router;
