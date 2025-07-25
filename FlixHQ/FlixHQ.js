/** biome-ignore-all lint/correctness/noUnusedVariables: <debug> */

async function searchResults(search) {
	console.log(`[FlixHQ] (debug): searchResults called with search = ${search}`);
	const results = [];

	try {
		const encodedSearch = encodeURIComponent(search);
		console.log(`[FlixHQ] (debug): Encoded search = ${encodedSearch}`);
		const searchURL = `https://flixhq.watch/search?keyword=${encodedSearch}`;
		console.log(`[FlixHQ] (debug): searchURL = ${searchURL}`);
		const searchResponse = await fetchv2(searchURL);
		console.log(
			`[FlixHQ] (debug): searchResponse status = ${searchResponse.status}`,
		);
		const responseHTML = await searchResponse.text();
		console.log(
			`[FlixHQ] (debug): Received responseHTML length = ${responseHTML.length}`,
		);

		const listMatch = responseHTML.match(
			/<div class="film_list-wrap">([\s\S]*?)<div class="clearfix"><\/div>\s*<\/div>/,
		);
		console.log(`[FlixHQ] (debug): listMatch found = ${!!listMatch}`);
		if (!listMatch) return JSON.stringify(results);

		const listHtml = listMatch[1];
		console.log(
			`[FlixHQ] (debug): listHtml (first 1000 chars) = ${listHtml.slice(0, 1000)}`,
		);
		const itemRegex =
			/<div class="flw-item"[\s\S]*?<\/div>\s*<div class="clearfix"><\/div>?/g;
		console.log(`[FlixHQ] (debug): itemRegex = ${itemRegex}`);
		const items = listHtml.match(itemRegex) || [];
		console.log(`[FlixHQ] (debug): items found = ${items.length}`);

		items.forEach((itemHtml, idx) => {
			console.log(`[FlixHQ] (debug): Processing item ${idx}`);
			const imgMatch = itemHtml.match(
				/<div class="film-poster">[\s\S]*?<img[^>]+src="([^"]+)"/,
			);
			const detailMatch = itemHtml.match(
				/<h3 class="film-name">[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/,
			);
			console.log(
				`[FlixHQ] (debug): imgMatch = ${!!imgMatch}, detailMatch = ${!!detailMatch}`,
			);
			if (imgMatch && detailMatch) {
				let image = imgMatch[1];
				if (!image.startsWith("http")) image = `https:${image}`;
				console.log(
					`[FlixHQ] (debug): Pushing result: title = ${detailMatch[2].trim()}, href = ${detailMatch[1].trim()}, image = ${image.trim()}`,
				);
				results.push({
					title: detailMatch[2].trim(),
					href: detailMatch[1].trim(),
					image: image.trim(),
				});
			}
		});
		console.log(`[FlixHQ] (debug): Returning ${results.length} results`);
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
	console.log(`[FlixHQ] (debug): extractDetails called with url = ${url}`);
	try {
		const searchResponse = await fetchv2(url);
		console.log(
			`[FlixHQ] (debug): searchResponse status = ${searchResponse.status}`,
		);
		const responseHTML = await searchResponse.text();
		console.log(
			`[FlixHQ] (debug): Received responseHTML length = ${responseHTML.length}`,
		);

		const contentMatch = responseHTML.match(
			/<div class="m_i-d-content">([\s\S]*?)<div class="clearfix"><\/div>\s*<\/div>/,
		);
		console.log(`[FlixHQ] (debug): contentMatch found = ${!!contentMatch}`);
		if (!contentMatch) {
			console.log(`[FlixHQ] (debug): No contentMatch, returning no details`);
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
		console.log(`[FlixHQ] (debug): description = ${description}`);

		const airDateMatch = content.match(
			/<div class="row-line">\s*<span class="type">Released:<\/span>([^<\n]+)</,
		);
		let airDate = "N/A";
		if (airDateMatch) {
			airDate = airDateMatch[1].replace(/\s+/g, " ").trim();
		}
		console.log(`[FlixHQ] (debug): airDate = ${airDate}`);

		return JSON.stringify([
			{
				description,
				aliases: "N/A",
				airdate: airDate,
			},
		]);
	} catch (error) {
		console.error(`[FlixHQ] Failed to extract details: ${error}`);

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
	console.log(`[FlixHQ] (debug): extractEpisodes called with url = ${url}`);
	const results = [];

	try {
		const searchResponse = await fetchv2(url);
		console.log(
			`[FlixHQ] (debug): searchResponse status = ${searchResponse.status}`,
		);
		const responseHTML = await searchResponse.text();
		console.log(
			`[FlixHQ] (debug): Received responseHTML length = ${responseHTML.length}`,
		);

		const episodesSection = responseHTML.match(
			/<div id="content-episodes"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/,
		);
		console.log(
			`[FlixHQ] (debug): episodesSection found = ${!!episodesSection}`,
		);
		if (!episodesSection) {
			console.log(
				`[FlixHQ] (debug): No episodesSection, returning empty results`,
			);
			return JSON.stringify(results);
		}

		const sectionHTML = episodesSection[0];
		const seasonRegex =
			/<a[^>]+data-id="([^"]+)"[^>]*class="dropdown-item[^"]*"[^>]*>/g;
		const seasonIDs = [];
		let seasonMatch = seasonRegex.exec(sectionHTML);
		while (seasonMatch !== null) {
			seasonIDs.push(seasonMatch[1]);
			console.log(`[FlixHQ] (debug): Found seasonID = ${seasonMatch[1]}`);
			seasonMatch = seasonRegex.exec(sectionHTML);
		}
		console.log(
			`[FlixHQ] (debug): Total seasonIDs found = ${seasonIDs.length}`,
		);

		if (seasonIDs.length === 0) {
			const episodeRegex = /<a[^>]+href="([^"]+)"[^>]*title="Episode (\d+)/g;
			let match = episodeRegex.exec(sectionHTML);
			while (match !== null) {
				console.log(
					`[FlixHQ] (debug): Found episode: href = ${match[1].trim()}, number = ${match[2].trim()}`,
				);
				results.push({
					href: match[1].trim(),
					number: match[2].trim(),
				});
				match = episodeRegex.exec(sectionHTML);
			}
			console.log(
				`[FlixHQ] (debug): Returning ${results.length} episodes (no seasons)`,
			);
			return JSON.stringify(results);
		}

		for (const seasonID of seasonIDs) {
			const ajaxURL = `https://flixhq.watch/ajax/ajax.php?episode=${seasonID}`;
			console.log(`[FlixHQ] (debug): Fetching ajaxURL = ${ajaxURL}`);
			const ajaxResp = await fetchv2(ajaxURL);
			console.log(`[FlixHQ] (debug): ajaxResp status = ${ajaxResp.status}`);
			const ajaxHTML = await ajaxResp.text();
			console.log(`[FlixHQ] (debug): ajaxHTML length = ${ajaxHTML.length}`);
			const episodeRegex = /<a[^>]+href="([^"]+)"[^>]*title="Episode (\d+)/g;
			let match = episodeRegex.exec(ajaxHTML);
			while (match !== null) {
				console.log(
					`[FlixHQ] (debug): Found episode: href = ${match[1].trim()}, number = ${match[2].trim()}`,
				);
				results.push({
					href: match[1].trim(),
					number: match[2].trim(),
				});
				match = episodeRegex.exec(ajaxHTML);
			}
		}
		console.log(
			`[FlixHQ] (debug): Returning ${results.length} episodes (with seasons)`,
		);
		return JSON.stringify(results);
	} catch (error) {
		console.error(`[FlixHQ] Failed to extract episodes: ${error}`);

		return JSON.stringify([]);
	}
}

async function extractStreamUrl(url) {
	console.log(`[FlixHQ] (debug): extractStreamUrl called with url = ${url}`);
	try {
		const searchResponse = await fetchv2(url);
		console.log(
			`[FlixHQ] (debug): searchResponse status = ${searchResponse.status}`,
		);
		const responseHTML = await searchResponse.text();
		console.log(
			`[FlixHQ] (debug): Received responseHTML length = ${responseHTML.length}`,
		);
		const iframeMatch = responseHTML.match(
			/<iframe[^>]+src=["']([^"']+)["'][^>]*>/i,
		);
		console.log(`[FlixHQ] (debug): iframeMatch found = ${!!iframeMatch}`);
		const stream = iframeMatch ? iframeMatch[1] : null;
		console.log(`[FlixHQ] (debug): stream = ${stream}`);
		return stream;
	} catch (error) {
		console.error(`[FlixHQ] Failed to extract stream URL: ${error}`);

		return null;
	}
}
