# Averti

Averti is a proactive safety browser extension designed to block threats, protect users (especially students), and provide real-time warnings on potentially harmful websites. It integrates seamlessly with web browsers to enhance online security.

## Project Structure

- **Extension/**: Contains the browser extension files, including manifest, scripts, and UI components.
- **websites/**: Includes demo websites for testing and demonstration purposes.
  - **averti-website/**: The official Averti Labs website showcasing cyber security solutions.
  - **nichedetail-website/**: A sample niche website (auto detailing) used for extension testing.

## Installation and Usage

### Installing the Extension

1. Open your browser (Chrome recommended, as it uses Manifest V3).
2. Navigate to the extensions page (e.g., `chrome://extensions/`).
3. Enable "Developer mode" in the top right.
4. Click "Load unpacked" and select the `Extension/` folder from this project.
5. The Averti extension will be installed and appear in your browser toolbar.

### Using the Extension

- Once installed, Averti runs in the background and monitors web activity.
- It uses content scripts to inject warnings on supported sites (e.g., Google domains).
- Access the control center via the extension icon in the toolbar.
- Configure settings through the popup interface.

### Running Demo Websites

To test the extension or view the websites locally:

1. Open the `index.html` file in your browser from the respective website folder (e.g., `websites/averti-website/index.html`).
2. For the nichedetail-website, ensure the `data/niche_config.json` is accessible for dynamic content.

## Features

- Real-time threat blocking using Declarative Net Request.
- Storage for user preferences and configurations.
- Active tab monitoring and alarms for periodic checks.
- Omnibox integration for quick access.
- Content scripts for targeted warnings.

## Contributing

This project is open-source. Contributions are welcome! Please fork the repository and submit pull requests.

## License

[Specify license if applicable, e.g., MIT]

## Contact

For more information, visit [Averti Labs](https://averti-labs.com) or contact the maintainers.