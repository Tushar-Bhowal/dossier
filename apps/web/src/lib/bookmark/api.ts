import { ApiError } from "@/lib/api";
import { sleep } from "@/lib/demo/scenario";
import { parseJobPage, type PageInfo, type ParsedJob } from "./parse";
import { bookmarkScenario } from "./scenario";

// Stage 1 reads only what the bookmark passes (address, title, selected text). S8 adds a server-side
// read of the page itself for the job description, behind this same function.
export async function readJobPage(page: PageInfo): Promise<ParsedJob> {
  await sleep(bookmarkScenario.getScenario().latency === "slow" ? 6000 : 700);
  if (bookmarkScenario.getScenario().fail === "parse_fails") throw new ApiError(422, "unreadable", "We couldn't read that page.");
  return parseJobPage(page);
}
