# 🚀 GitHub Deployment Guide for N-Cafe

Yes, you can upload all 3 pages (`customer.html`, `staff-new.html`, `admin.html`) to the **same root folder** on GitHub.

## 1. File Structure
Keep your files in the root of the repository (where they are now):
```text
/ (Root)
├── customer.html      (Main Client Site)
├── staff-new.html     (Staff Dashboard)
├── admin.html         (Admin Dashboard)
├── data.js            (Shared Data)
├── customer.js        (Client Logic)
├── staff-new.js       (Staff Logic)
└── admin.js           (Admin Logic)
```

## 2. How URLs Will Work
Once you enable **GitHub Pages**, your URLs will look like this:

| Page | URL | Notes |
|------|-----|-------|
| **Main Site** | `https://[username].github.io/[project-name]/` | By default, this loads `index.html`. |
| **Client App** | `https://[username].github.io/[project-name]/customer.html` | Accessible via direct link. |
| **Staff App** | `https://[username].github.io/[project-name]/staff-new.html` | Accessible via direct link. |
| **Admin App** | `https://[username].github.io/[project-name]/admin.html` | Accessible via direct link. |

## 3. Recommended Change: "Main Page" Setup
To make `customer.html` load automatically when people visit your main link, you have two options:

### Option A: Rename `customer.html` (Recommended)
Rename `customer.html` → `index.html`.
*   **Result:** Visitors to `https://[username].github.io/[project-name]/` immediately see the Client App.

### Option B: Create a Landing Page
Create a simple `index.html` that has buttons linking to each app.
*   **Result:** Visitors see a menu to choose "Client", "Staff", or "Admin".

## 4. How to Enable GitHub Pages
1.  Upload your code to GitHub.
2.  Go to **Settings** tab in your repository.
3.  Click **Pages** in the left sidebar.
4.  Under "Build and deployment", select **Source** as `Deploy from a branch`.
5.  Under "Branch", select `main` (or `master`) and `/ (root)`.
6.  Click **Save**.
7.  Wait a minute, and your site will be live!
