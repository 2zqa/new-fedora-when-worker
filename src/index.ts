/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
			"Access-Control-Max-Age": "86400",
		};

		const DEFAULT_VERSION = "f-41";

		async function handleRequest(request: Request) {
			const url = new URL(request.url);
			let version = url.searchParams.get("version") ?? DEFAULT_VERSION;
			const validVersions = ["f-39", "f-40", "f-41", "f-42", "f-43"];
			if (!validVersions.includes(version)) {
				version = DEFAULT_VERSION;
			}
			const apiUrl = `https://fedorapeople.org/groups/schedule/${version}/${version}-key.ics`;


			// Rewrite request to point to API URL. This also makes the request mutable
			// so you can add the correct Origin header to make the API server think
			// that this request is not cross-site.
			request = new Request(apiUrl, request);
			request.headers.set("Origin", new URL(apiUrl).origin);
			let response = await fetch(request);

			// Recreate the response so you can modify the headers
			response = new Response(response.body, response);

			// Set CORS headers
			response.headers.set("Access-Control-Allow-Origin", url.origin);
			// Append to/Add Vary header so browser will cache response correctly
			response.headers.append("Vary", "Origin");

			return response;
		}

		async function handleOptions(request: Request) {
			if (
				request.headers.get("Origin") !== null &&
				request.headers.get("Access-Control-Request-Method") !== null &&
				request.headers.get("Access-Control-Request-Headers") !== null
			) {
				// Handle CORS preflight requests.
				return new Response(null, {
					headers: {
						...corsHeaders,
						"Access-Control-Allow-Headers": request.headers.get(
							"Access-Control-Request-Headers",
						),
					},
				});
			} else {
				// Handle standard OPTIONS request.
				return new Response(null, {
					headers: {
						Allow: "GET, HEAD, POST, OPTIONS",
					},
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
