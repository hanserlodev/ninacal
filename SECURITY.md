# Security policy

## Supported versions

NinaCal is pre-alpha. Only the `main` branch receives security fixes.

## Reporting a vulnerability

**Do not open a public issue.** Use GitHub's private reporting:

1. Open the **Security** tab of the repository.
2. Choose **Report a vulnerability** (GitHub Security Advisories).
3. Describe the issue, how to reproduce it, and the impact you suspect.

If private reporting is unavailable, message a maintainer directly and ask for a safe
channel before sharing details.

### What to expect

- Acknowledgement in a reasonable window (ideally 72 hours).
- An assessment and a fix plan if the issue is confirmed.
- Public credit when appropriate, if you want it.

### Out of scope

- Denial-of-service attacks against static hosting.
- Social engineering against contributors.
- Automated reports without a demonstrated impact.
- Missing security headers that are the hosting provider's responsibility.

## For contributors

- Never commit secrets, tokens or keys. Environment files are git-ignored.
- Any new dependency must have a license compatible with MIT and a real maintainer.
- Committed data is public by design: it must be aggregated, derived from open data, and
  contain no personal information.
