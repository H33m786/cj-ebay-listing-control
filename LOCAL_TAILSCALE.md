# Local Tailscale Mode

Use this mode when the laptop should be the main server and the phone should connect to it privately through Tailscale. Neon is not needed.

## Laptop setup

1. Install Tailscale on the laptop and phone, then sign into the same Tailscale account.
2. In this project, copy `.env.example` to `.env`.
3. Leave `DATABASE_URL=` blank.
4. Set:

```env
LOCAL_NETWORK=true
HOST=0.0.0.0
APP_USERNAME=your-private-username
APP_PASSWORD=use-a-long-password-at-least-16-characters
APP_URL=
```

5. Keep your existing eBay and CJ values in `.env`.
6. Start the app:

```bash
npm run local
```

The terminal will show `http://localhost:5173` for the laptop and one or more network URLs.

## Phone access

On your phone, open Tailscale and make sure it is connected. Then open:

```text
http://YOUR-LAPTOP-TAILSCALE-NAME:5173
```

or:

```text
http://YOUR-LAPTOP-100.X.Y.Z:5173
```

Sign in with `APP_USERNAME` and `APP_PASSWORD`.

## Notes

- The laptop must be on, online, and running `npm run local`.
- Data is saved in the laptop `data/` folder.
- eBay OAuth still needs the accepted URL/RuName configured for the callback you use. The easiest option is to keep doing OAuth from the laptop at `http://localhost:5173/auth/ebay/callback`.
- Phone access over Tailscale is private, not a public website.
