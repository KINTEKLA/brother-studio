# Brother Studio

Brother Studio is a browser-based application for preparing and printing experimental black-and-white artwork with Brother QL thermal label printers. It is intended for creative printmaking rather than conventional office-label design.

The application runs locally on a Linux computer. Its browser interface supports image processing, previewing, cropping, printing, and a saved Print History gallery. Once installed, normal operation does not require an internet connection.

## Features

- Upload PNG and JPEG images
- Adjust contrast and threshold
- Choose threshold processing, Floyd–Steinberg dithering, or custom line halftone processing
- View live previews and compare original and processed artwork
- Inspect artwork with zooming and panning
- Crop and position images using adjustable crop dimensions
- Rotate artwork 90° for panoramic printing on continuous label stock
- Export processed artwork as PNG without printing
- Save printed artwork and processing metadata in Print History
- Reprint or export saved artwork and delete history entries
- Print 1–50 copies, with individual print-and-cut operations
- Optionally access the interface from another device on a trusted local network

## Tested environment

| Item | Verified configuration |
| --- | --- |
| Operating system | Kali Linux |
| Printer | Brother QL-570 |
| Connection | USB through PyUSB |
| Printer USB ID | `04f9:2028` |
| Label stock | 62 mm continuous (DK-2205 format) |
| Processing output width | 696 pixels |

The application was installed and tested on two Kali Linux computers:

- **TT Kali:** browser interface, image adjustments, cropping, PNG export, Print History, and physical printing on a USB-connected QL-570.
- **2012 Mac Mini running Kali Linux:** clean installation, server startup, and remote browser access. Physical printing was **not** verified on this machine because the printer was connected to TT Kali.

Other QL-series printers may be supported by the underlying `brother_ql` project, but **they have not been verified with Brother Studio**. Changing printer settings does not automatically adapt the application's fixed 696-pixel image-processing width.

## Requirements

- A Linux computer with Python 3 and working `venv` support
- Git (for cloning the repository)
- Network access during initial dependency installation
- A web browser
- A supported USB-connected printer and appropriate USB device permissions **for printing**; no printer is needed to explore image processing or PNG export

On Debian-based systems, Python virtual environment support may need to be installed separately (for example, with the distribution's `python3-venv` package).

## Install and run

When the public repository is available, clone it using its actual GitHub URL:

```bash
git clone https://github.com/USERNAME/brother-studio.git
cd brother-studio
```

**Note:** `USERNAME` is a placeholder. This project has not yet been published at that URL.

Install the Python dependencies into a project-local virtual environment:

```bash
./install.sh
```

Start the application:

```bash
./launch.sh
```

Open <http://127.0.0.1:5000> in a browser on the same computer. Use Ctrl+C in the terminal to stop the server.

### Port and local-network access

The default host is `127.0.0.1` (local computer only), on port `5000`. To change the port:

```bash
BROTHER_STUDIO_PORT=5001 ./launch.sh
```

To permit access from another device on a **trusted local network**:

```bash
BROTHER_STUDIO_HOST=0.0.0.0 ./launch.sh
```

Then open `http://HOST_IP:5000` on that device, substituting the Linux computer's actual IP address.

**Security warning:** Brother Studio currently has no user authentication. LAN mode exposes application functions, including printing and history management, to devices that can reach the service. Do not expose the application to the public internet or untrusted networks. The current launcher uses Flask's built-in server; it is intended for controlled local use, not internet-facing deployment.

## Printer settings

The defaults match the configuration physically tested during development:

| Environment variable | Default |
| --- | --- |
| `BROTHER_STUDIO_BACKEND` | `pyusb` |
| `BROTHER_STUDIO_MODEL` | `QL-570` |
| `BROTHER_STUDIO_ADDRESS` | `usb://0x04f9:0x2028` |
| `BROTHER_STUDIO_LABEL` | `62` |

These settings can be supplied as environment variables when launching the application. Model or label changes have not been tested and may require additional image-processing changes.

If printing fails with `Device not found`, check that the printer is connected **to the computer running Brother Studio**, is powered on, and is accessible to the user's USB permissions. Opening the browser on a different computer does not transfer the printer's USB connection.

## Print History and user data

Print History stores processed PNGs and metadata. It does not preserve the original uploaded image for later re-editing.

By default, data is stored outside the source tree:

```text
~/.local/share/brother-studio/
├── prints.json
└── images/
```

This can be changed using `BROTHER_STUDIO_DATA_DIR`, or by setting `XDG_DATA_HOME`. Keep personal artwork and local history out of the Git repository.

## Known limitations

- Only the Brother QL-570 and 62 mm continuous stock have been physically verified.
- USB permissions may need configuration on a new Linux system; the installer does not currently set up udev rules.
- Uneven left/right print margins were observed in earlier testing; the cause is not confirmed.
- Print History saves processed artwork, not original uploaded files.
- The browser interface has no authentication.
- Windows and macOS operation has not been verified.
- Compatibility with other printers and label widths is not established.

## Technical overview

Brother Studio is written in Python, Flask, Pillow, HTML, CSS, and JavaScript. It invokes the `brother_ql` command-line tool for printer communication, using PyUSB for the tested printer backend. The main source files are `app.py`, `processing.py`, `print_history.py`, `templates/index.html`, `static/style.css`, and `static/studio.js`.

The direct Python dependencies are listed in `requirements.txt` and are installed by `install.sh`. No virtual environment or personal data should be committed to the repository.

## Credits

Brother Studio was created through substantial AI-assisted programming with ChatGPT. The project's design choices, feature direction, hands-on testing, and validation were directed by its creator.

Printer communication relies on [brother_ql](https://github.com/pklaus/brother_ql), developed by Philipp Klaus and contributors. Additional dependencies include Flask, Pillow, and PyUSB.

## License

Brother Studio is licensed under the GNU General Public License
version 3 or later (GPL-3.0-or-later).

See [LICENSE](LICENSE) and [COPYRIGHT](COPYRIGHT) for details.

Third-party dependencies retain their respective licenses.
