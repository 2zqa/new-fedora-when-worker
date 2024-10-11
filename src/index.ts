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
			// TODO: allow localhost:8000, 0.0.0.0:8000, and 2zqa.github.io
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET,OPTIONS",
			"Access-Control-Max-Age": "86400",
		};
		const DEFAULT_VERSION = "f-41";


		/**
		 * Finds the start date from the first ical event with the given summary.
		 *
		 * @param icalData - The ical data as a string.
		 * @param summary - The exact summary of the event to find.
		 * @returns The start date of the event if found, otherwise null.
		 */
		function findEventDate(icalData: string, summary: string): Date | null {
			// Split the content by lines
			const lines = icalData.split(/\r?\n/);

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (line.startsWith(`SUMMARY:${summary}`)) {
					const nextLine = lines[i + 1];
					if (nextLine.startsWith('DTSTART:')) {
						const dtstart = nextLine.substring('DTSTART:'.length).trim();
						return parseDateFromIcalDate(dtstart);
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
		function parseDateFromIcalDate(dtstart: string) {
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
			if (version === null) {
				return new Response(JSON.stringify({ "error": "Invalid version parameter. Allowed values: f-39, f-40, f-41, f-42, f-43" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
			}
			const response = await fetch(`https://fedorapeople.org/groups/schedule/${version}/${version}-key.ics`);
			const icalData = await response.text();
			const eventDate = findEventDate(icalData, "Current Final Target date");
			if (eventDate === null) {
				return new Response(null, { status: 204 });
			}

			return new Response(JSON.stringify({ "event_date": eventDate }), {
				headers: {
					"Content-Type": "application/json",
					"Cache-Control": "public, max-age=86400",
					...corsHeaders,
				},
			});
		}

		function getVersionFromRequest(request: Request): string | null {
			const url = new URL(request.url);
			let version = url.searchParams.get("version");
			if (version === null) {
				return null;
			}
			const allowedVersions = new Set(["f-39", "f-40", "f-41", "f-42", "f-43"]);
			if (!allowedVersions.has(version)) {
				return null;
			}
			return version;
		}

		if (request.method === "GET") {
			// Handle requests to the API server
			return handleRequest(request);
		} else {
			return new Response(null, { status: 405 });
		}
	},
} satisfies ExportedHandler<Env>;
