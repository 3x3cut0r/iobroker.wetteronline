---
---

![Logo](wetteronline.png)

# ioBroker.wetteronline

[![NPM version](https://img.shields.io/npm/v/iobroker.wetteronline.svg)](https://www.npmjs.com/package/iobroker.wetteronline)
[![Downloads](https://img.shields.io/npm/dm/iobroker.wetteronline.svg)](https://www.npmjs.com/package/iobroker.wetteronline)
![Number of Installations](https://iobroker.live/badges/wetteronline-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/wetteronline-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.wetteronline.png?downloads=true)](https://nodei.co/npm/iobroker.wetteronline/)

**Tests:** ![Test and Release](https://github.com/3x3cut0r/ioBroker.wetteronline/workflows/Test%20and%20Release/badge.svg)

## wetteronline adapter for ioBroker

Weather forecast from wetteronline.de.

This IP Broker Adapter receives data through a http request of a given url from wetteronline.de (no API).

Provide URL in this format: `https://www.wetteronline.de/wetter/<city>`

For development and release instructions, see [README-DEV](README-DEV.md).

## Changelog

<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->
### 1.2.0 (2025-01-26)

- New: Added forecastHourly channels (0h, 1h, ...)
- Renamed channels to follow a more common naming convention (forecast.0d.0dt.key)
- Fix: Delete object tree after URL has changed to clean zombie objects.
- Translation has been updated to new keys

### 1.1.0 (2025-01-23)

- New: Added daytime channels for each forecast.days (Morning, Afternoon, Evening, Night)
- New: Added daytime.keys (precipitation, windGustsBft, windGustsKmh, windSpeedText, windDirection, windSpeedKmh, windSpeedBft, temperature, temperature_feelslike, windDirectionShortSector)
- Update-Interval has been reduced to 25 minutes
- Translation has been updated to new keys

### v1.0.0 (2025-01-05)

- Initial release

## Terms of Use

Please note that this adapter retrieves the weather data from [wetteronline.de](https://www.wetteronline.de).  
This data is subject to the [terms and conditions](https://www.wetteronline.de/agb), the [legal notice](https://www.wetteronline.de/impressum) and the [privacy policy](https://www.wetteronline.de/datenschutz?memberdisplay=false) of wetteronline.de.  
The automated retrieval or further use of the data may be subject to restrictions that you must check and comply with yourself.

The MIT license below refers exclusively to the source code of this adapter. It does not cover the content provided by wetteronline.de or its further use.

## License

MIT License

Copyright (c) 2025 3x3cut0r <julianreith@gmx.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
