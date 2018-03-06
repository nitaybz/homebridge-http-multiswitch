# homebridge-synology-surveillance-homemode

Simple Homebridge plugin to turn on/off homemode on Synology Surveillance station.

Switch "on" -> home mode off (cameras are on)
Switch "off" -> home mode on (cameras are off)

Configuration:
```
 {
            "accessory": "SSHomeMode",
            "name": "Security Cameras",
            "url": "https://192.168.1.x:5000/",
            "username": "user",
            "password": "password
        }
```