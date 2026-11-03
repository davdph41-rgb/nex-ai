export async function searchGitHub({ query }) {

    if (!query || !query.trim()) {
        throw new Error("Kata pencarian GitHub diperlukan");
    }

    const searchURL =
        "https://api.github.com/search/repositories" +
        `?q=${encodeURIComponent(query.trim())}` +
        "&sort=stars&order=desc&per_page=5";

    const response = await fetch(searchURL, {
        headers: {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.message || "Gagal mencari repositori GitHub"
        );
    }

    return {
        total: data.total_count,
        repositories: (data.items || []).map(repo => ({
            name: repo.full_name,
            description: repo.description,
            language: repo.language,
            stars: repo.stargazers_count,
            url: repo.html_url
        }))
    };
}
