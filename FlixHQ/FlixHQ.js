/** biome-ignore-all lint/correctness/noUnusedVariables: <debug> */

async function searchResults(search) {
	const results = [];

	try {
		const encodedSearch = encodeURIComponent(search);
		const searchURL = `https://flixhq.watch/search?keyword=${encodedSearch}`;
		const searchResponse = await fetchv2(searchURL);
		const responseHTML = await searchResponse.text();

		const listMatch = responseHTML.match(
			/<div class="film_list-wrap">([\s\S]*?)<div class="clearfix"><\/div>\s*<\/div>/,
		);
		if (!listMatch) return JSON.stringify(results);

		const listHtml = listMatch[1];
		const itemRegex =
			/<div class="flw-item"[\s\S]*?<\/div>\s*<div class="clearfix"><\/div>?/g;
		const items = listHtml.match(itemRegex) || [];

		items.forEach((itemHtml) => {
			const imgMatch = itemHtml.match(
				/<div class="film-poster">[\s\S]*?<img[^>]+src="([^"]+)"/,
			);
			const detailMatch = itemHtml.match(
				/<h3 class="film-name">[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/,
			);

			if (imgMatch && detailMatch) {
				let image = imgMatch[1];
				if (!image.startsWith("http")) image = `https:${image}`;
				results.push({
					title: detailMatch[2].trim(),
					href: detailMatch[1].trim(),
					image: image.trim(),
				});
			}
		});
		return JSON.stringify(results);
	} catch (error) {
		console.error(`[FlixHQ] Failed to extract search results: ${error}`);

		return JSON.stringify([
			{
				title: "Error",
				href: "",
				image: "",
			},
		]);
	}
}

async function extractDetails(url) {
	try {
		const searchResponse = await fetchv2(url);
		const responseHTML = await searchResponse.text();

		const contentMatch = responseHTML.match(
			/<div class="m_i-d-content">([\s\S]*?)<div class="clearfix"><\/div>\s*<\/div>/,
		);
		if (!contentMatch) {
			return JSON.stringify([
				{
					description: "No details found",
					aliases: "N/A",
					airdate: "N/A",
				},
			]);
		}
		const content = contentMatch[1];

		const descriptionMatch = content.match(
			/<div class="description">([\s\S]*?)<\/div>/,
		);
		const description = descriptionMatch
			? descriptionMatch[1]
					.replace(/<br\s*\/?>/gi, "\n")
					.replace(/\s+/g, " ")
					.trim()
			: "No description available";

		const airDateMatch = content.match(
			/<div class="row-line">\s*<span class="type">Released:<\/span>([^<\n]+)</,
		);
		let airDate = "N/A";
		if (airDateMatch) {
			airDate = airDateMatch[1].replace(/\s+/g, " ").trim();
		}

		return JSON.stringify([
			{
				description,
				aliases: "N/A",
				airdate: airDate,
			},
		]);
	} catch (error) {
		console.log(`[FlixHQ] Failed to extract details: ${error}`);

		return JSON.stringify([
			{
				description: "Error loading description",
				aliases: "N/A",
				airdate: "N/A",
			},
		]);
	}
}

async function extractEpisodes(url) {
	const results = [];

	try {
		const searchResponse = await fetchv2(url);
		const responseHTML = await searchResponse.text();

		const episodesSection = responseHTML.match(
			/<div id="content-episodes"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/,
		);
		if (!episodesSection) {
			return JSON.stringify(results);
		}

		const sectionHTML = episodesSection[0];
		const seasonRegex =
			/<a[^>]+data-id="([^"]+)"[^>]*class="dropdown-item[^"]*"[^>]*>/g;
		const seasonIDs = [];
		let seasonMatch = seasonRegex.exec(sectionHTML);
		while (seasonMatch !== null) {
			seasonIDs.push(seasonMatch[1]);
			seasonMatch = seasonRegex.exec(sectionHTML);
		}

		if (seasonIDs.length === 0) {
			const episodeRegex = /<a[^>]+href="([^"]+)"[^>]*title="Episode (\d+)/g;
			let match = episodeRegex.exec(sectionHTML);
			while (match !== null) {
				results.push({
					href: match[1].trim(),
					number: match[2].trim(),
				});
				match = episodeRegex.exec(sectionHTML);
			}
			return JSON.stringify(results);
		}

		for (const seasonID of seasonIDs) {
			const ajaxURL = `https://flixhq.watch/ajax/ajax.php?episode=${seasonID}`;
			const ajaxResp = await fetchv2(ajaxURL);
			const ajaxHTML = await ajaxResp.text();
			const episodeRegex = /<a[^>]+href="([^"]+)"[^>]*title="Episode (\d+)/g;
			let match = episodeRegex.exec(ajaxHTML);
			while (match !== null) {
				results.push({
					href: match[1].trim(),
					number: match[2].trim(),
				});
				match = episodeRegex.exec(ajaxHTML);
			}
		}
		return JSON.stringify(results);
	} catch (error) {
		console.log(`[FlixHQ] Failed to extract episodes: ${error}`);
		return JSON.stringify([]);
	}
}

async function extractStreamUrl(url) {
	try {
		const searchResponse = await fetchv2(url);
		const responseHTML = await searchResponse.text();
		const iframeMatch = responseHTML.match(
			/<iframe[^>]+src=["']([^"']+)["'][^>]*>/i,
		);
		const stream = iframeMatch ? iframeMatch[1] : null;
		return stream;
	} catch (error) {
		console.log(`[FlixHQ] Failed to extract stream URL: ${error}`);
		return null;
	}
}
