/**
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
export default {
	async fetch(request, env, ctx): Promise<Response> {
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET,OPTIONS",
			"Access-Control-Max-Age": "86400",
		};
		const DEFAULT_VERSION = "f-41";


		function findEventDate(icsData: string, summary: string): Date | null {
			// Split the content by lines
			const lines = icsData.split(/\r?\n/);

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (line.startsWith(`SUMMARY:${summary}`)) {
					const nextLine = lines[i + 1];
					if (nextLine.startsWith('DTSTART:')) {
						const dtstart = nextLine.substring('DTSTART:'.length).trim();
						return parseDateFromICSDate(dtstart);
					}
				}
			}
			return null;
		}

		/**
		 * Parses a date string in the format `YYYYMMDDTHHmmssZ` and returns a JavaScript `Date` object.
		 *
		 * @param dtstart - The date string in the format `YYYYMMDDTHHmmssZ`.
		 * @returns A `Date` object representing the parsed date and time in UTC.
		 */
		function parseDateFromICSDate(dtstart: string) {
			const year = parseInt(dtstart.substring(0, 4), 10);
			const month = parseInt(dtstart.substring(4, 6), 10) - 1; // Months are 0-based in JavaScript Date
			const day = parseInt(dtstart.substring(6, 8), 10);
			const hour = parseInt(dtstart.substring(9, 11), 10);
			const minute = parseInt(dtstart.substring(11, 13), 10);
			const second = parseInt(dtstart.substring(13, 15), 10);
			return new Date(Date.UTC(year, month, day, hour, minute, second));
		}

		async function handleRequest(request: Request) {
			const version = getVersionFromRequest(request);
			const response = await fetch(`https://fedorapeople.org/groups/schedule/${version}/${version}-key.ics`);
			const icsData = await response.text();
			const eventDate = findEventDate(icsData, "Current Final Target date");
			if (eventDate === null) {
				return new Response(null, { status: 204 });
			}

			return new Response(JSON.stringify({ "event_date": eventDate }), {
				headers: {
					"content-type": "application/json",
					...corsHeaders,
				},
			});
		}

		function getVersionFromRequest(request: Request<unknown, CfProperties<unknown>>) {
			const url = new URL(request.url);
			let version = url.searchParams.get("version") ?? DEFAULT_VERSION;
			const validVersions = ["f-39", "f-40", "f-41", "f-42", "f-43"];
			if (!validVersions.includes(version)) {
				version = DEFAULT_VERSION;
			}
			return version;
		}

		async function handleOptions(request: Request) {
			if (
				request.headers.get("Origin") !== null &&
				request.headers.get("Access-Control-Request-Method") !== null &&
				request.headers.get("Access-Control-Request-Headers") !== null
			) {
				// Handle CORS preflight requests.
				return new Response(null, { headers: corsHeaders });
			} else {
				// Handle standard OPTIONS request.
				return new Response(null, {
					headers: { Allow: "GET, OPTIONS" },
				});
			}
		}

		if (request.method === "OPTIONS") {
			// Handle CORS preflight requests
			return handleOptions(request);
		} else if (request.method === "GET") {
			// Handle requests to the API server
			return handleRequest(request);
		} else {
			return new Response(null, {
				status: 405,
				statusText: "Method Not Allowed",
			});
		}
	},
} satisfies ExportedHandler<Env>;
