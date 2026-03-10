# homebridge-http-multiswitch
Simple HTTP switches for Homebridge - stateful and radio-button/multi-switch switches.

**Modernized for Homebridge 1.6+ and Node.js 18+.**

*Forked from nitaybz/homebridge-http-multiswitch (originally from homebridge-switcheroo)*

_________________________________________
#### Creating and maintaining Homebridge plugins consume a lot of time and effort, if you would like to share your appreciation, feel free to "Star" or donate. 

<a target="blank" href="https://www.paypal.me/nitaybz"><img src="https://img.shields.io/badge/Donate-PayPal-blue.svg"/></a>
<a target="blank" href="https://blockchain.info/payment_request?address=18uuUZ5GaMFoRH5TrQFJATQgqrpXCtqZRQ"><img src="https://img.shields.io/badge/Donate-Bitcoin-green.svg"/></a>
_________________________________________

## What's New in v2.0.x
- **Native Fetch API:** Removed the deprecated `request` library in favor of the modern Node.js `fetch` API.
- **Improved Reliability:** Added state checks and concurrency locks to prevent redundant or overlapping HTTP requests.
- **Better HomeKit Support:** Explicitly names individual buttons in Multiswitch mode (e.g., "Low", "Medium", "High") so they appear correctly in the Home app.
- **Better Error Handling:** Detailed logs for failed requests, including the full URL and the specific error cause.

## Switch Services

### Switch (standard on/off)
Meant to be used as a standard on/off switch for lights, projectors, fans, etc.

```json
{
    "accessory": "HttpMultiswitch",
    "switch_type": "Switch",
    "name": "My Projector",
    "http_method": "GET",
    "base_url": "http://192.168.0.XXX/command/",
    "on_url": "on",
    "off_url": "off"
}
```

### Multiswitch (radio buttons)
Meant to be used as a switcher where only one input is ever on (radio button behavior). Turning one on automatically updates the others to off in HomeKit.

Individual button names (e.g., "Apple TV Mode") will be passed to HomeKit. If they appear grouped under the main accessory name, use the **"Show as Separate Tiles"** option in the Home app settings.

```json
{
    "accessory": "HttpMultiswitch",
    "switch_type": "Multiswitch",
    "name": "Media Center",
    "http_method": "GET",
    "base_url": "http://192.168.0.XXX/command?id=",
    "multiswitch": [
        "Apple TV Mode",
        "PC Mode",
        "Android Mode",
        "The Music Mode"
    ],
    "multiurls": [
        "43",
        "42786sdf787",
        "l1479461871215",
        "44"
    ]
}
```

## Configuration Params

| Parameter | Description | Required |
| :--- | :--- | :---: |
| `name` | Name of the accessory | ✓ |
| `switch_type` | `Switch` or `Multiswitch` | ✓ |
| `base_url` | Base URL for requests (include trailing slash if needed) | ✓ |
| `http_method` | `GET` (default), `POST`, `PUT`, `DELETE` | |
| `username` | Username for Basic Auth | |
| `password` | Password for Basic Auth | |
| `referer` | Referer header value | |
| `on_url` | (Switch only) Endpoint for ON state | ✓ |
| `off_url` | (Switch only) Endpoint for OFF state | ✓ |
| `on_body` | (Switch only) Body for ON request | |
| `off_body` | (Switch only) Body for OFF request | |
| `multiswitch` | (Multiswitch only) List of names for the buttons | ✓ |
| `multiurls` | (Multiswitch only) List of endpoints for the buttons | ✓ |

## Installation
This plugin requires **Node.js 18+** and **Homebridge 1.6+**.

1. Install Homebridge: `npm install -g homebridge`
2. Install this plugin: `npm install -g homebridge-http-multiswitch`
3. Use the **Homebridge Config UI X** to configure the plugin for the best experience.

### Manual Installation (from Git)
If you want to install directly from this repository:
`npm install -g https://github.com/fellowgeek/homebridge-http-multiswitch.git`

## Help
- **Trailing Slashes:** Ensure your `base_url` has a trailing slash if your `on_url` or `multiurls` are relative paths.
- **Port Numbers:** Specify the port if necessary (e.g., `http://192.168.0.XXX:2000/`).
- **Separate Tiles:** If your Multiswitch buttons show up as one tile, long-press it in the Home app, go to Settings, and select "Show as Separate Tiles".
