// Prints a signed approve/deny token for a submission group — the same
// token the admin email links carry. Email is disabled locally, so this
// is how the smoke test reaches /api/decide/<token>.
// Usage: SIGNING_SECRET=... npx tsx sign.ts <groupId> <approve|deny>
import { signDecideToken } from "../../../lib/tokens";

const [groupId, action] = process.argv.slice(2);
if (!groupId || (action !== "approve" && action !== "deny")) {
  console.error("usage: sign.ts <groupId> <approve|deny>");
  process.exit(2);
}
console.log(signDecideToken(groupId, action, process.env.SIGNING_SECRET!));
