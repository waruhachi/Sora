async function globalFetch(
	url,
	options = {
		headers: {},
		method: "GET",
		body: null,
	},
	toJSON = true,
) {
	try {
		const response = await fetchv2(
			url,
			options.headers ?? {},
			options.method ?? "GET",
			options.body ?? null,
		);

		return toJSON ? await response.json() : await response.text();
	} catch (e) {
		console.error(`[AnimeUA] Error fetching with fetchv2: ${e}`);
		return null;
	}
}

async function searchResults(search) {
	const results = [];

	try {
		const apiURL = "https://animeua.club/index.php?do=search";
		const apiBody = `do=search&subaction=search&search_start=0&full_search=0&result_from=1&story=${encodeURIComponent(search)}`;

		const apiResponse = await globalFetch(
			apiURL,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: apiBody,
			},
			false,
		);

		const posterRegex =
			/<a class="poster grid-item[^>]*href="([^"]+)"[^>]*>[\s\S]*?<img[^>]*data-src="([^"]+)"[^>]*>[\s\S]*?<h3 class="poster__title[^>]*>([^<]+)<\/h3>/g;

		let match;
		while (true) {
			match = posterRegex.exec(apiResponse);
			if (match === null) break;

			const href = match[1];
			let image = match[2];
			const title = match[3];

			if (image?.startsWith("/")) {
				image = `https://animeua.club${image}`;
			}

			const cleanTitle = title.trim();

			results.push({
				title: cleanTitle,
				href: href,
				image: image,
			});
		}

		return JSON.stringify(results);
	} catch (error) {
		console.error(`[AnimeUA] Error searching results: ${error}`);
	}
}

async function extractDetails(url) {
	try {
		const apiResponse = await globalFetch(url, {}, false);

		const airdateMatch = apiResponse.match(
			/<div class="pmovie__year">([^<]+)<\/div>/,
		);
		const aliasesMatch = apiResponse.match(
			/<div class="pmovie__original-title">([^<]+)<\/div>/,
		);
		const descriptionMatch = apiResponse.match(
			/<div class="page__text[^>]*>([\s\S]*?)<\/div>/,
		);

		const aliases = aliasesMatch ? aliasesMatch[1].trim() : "N/A";
		const airdate = airdateMatch
			? airdateMatch[1].trim().split(":")[1]?.trim() || "N/A"
			: "N/A";
		const description = descriptionMatch
			? descriptionMatch[1]
					.replace(/<[^>]*>/g, "")
					.replace(/\s+/g, " ")
					.trim()
			: "No description available";

		return JSON.stringify([
			{
				aliases,
				airdate,
				description,
			},
		]);
	} catch (error) {
		console.error(`[AnimeUA] Error extracting details: ${error}`);
	}
}

async function extractEpisodes(url) {
	const results = [];

	try {
		const apiResponse = await globalFetch(url, {}, false);
		if (!apiResponse) {
			return JSON.stringify(results);
		}

		const iframeMatch = apiResponse.match(
			/<div[^>]*class="[^"]*video-inside[^"]*"[^>]*>[\s\S]*?<iframe[^>]*data-src="([^"]+)"[^>]*>/,
		);
		if (!iframeMatch) {
			return JSON.stringify(results);
		}

		const videoInsideMatch = apiResponse.match(
			/<div[^>]*class="[^"]*video-inside[^"]*"[^>]*>/,
		);
		if (!videoInsideMatch) {
			return JSON.stringify(results);
		}

		const videoPlayerUrl = iframeMatch[1];
		const videoPageResponse = await globalFetch(videoPlayerUrl, {}, false);
		if (!videoPageResponse) {
			return JSON.stringify(results);
		}

		const playerjsMatch = videoPageResponse.match(
			/new Playerjs\(\{[\s\S]*?file:\s*'(\[[\s\S]*?\])'[\s\S]*?\}\)/,
		);
		if (!playerjsMatch) {
			return JSON.stringify(results);
		}

		try {
			const playerjsConfig = JSON.parse(playerjsMatch[1]);

			if (playerjsConfig.length > 0) {
				const firstSeason = playerjsConfig[0];
				if (firstSeason.folder) {
					for (const seasonFolder of firstSeason.folder) {
						if (seasonFolder.folder) {
							for (const episode of seasonFolder.folder) {
								if (episode.title && episode.file) {
									const cleanTitle = Number.parseInt(
										episode.title
											.replace(/^Серія\s*/i, "")
											.trim(),
										10,
									);

									results.push({
										href: episode.file,
										number: cleanTitle,
									});
								}
							}
						}
					}
				}
			}
		} catch (parseError) {
			console.error(
				`[AnimeUA] Failed to parse Playerjs configuration: ${parseError}`,
			);
		}

		return JSON.stringify(results);
	} catch (error) {
		console.error(`[AnimeUA] Error extracting episodes: ${error}`);
	}
}

async function extractStreamUrl(url) {
	return url;
}
