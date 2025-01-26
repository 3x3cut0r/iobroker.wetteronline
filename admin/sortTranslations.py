import json
import os


def sort_json_in_file(file_path):
    """
    Reads a JSON file, sorts the keys alphabetically and saves them back to the same file.

    Args:
        file_path (str): Path to JSON file
    """
    try:
        # Check if file exists
        if not os.path.isfile(file_path):
            raise FileNotFoundError(f"File not found: '{file_path}'")

        # Read JSON data from file
        with open(file_path, "r", encoding="utf-8") as file:
            data = json.load(file)

        # Check if JSON is a dictionary
        if not isinstance(data, dict):
            raise ValueError("JSON does not contain a dictionary.")

        # Sort keys
        sorted_data = {key: data[key] for key in sorted(data.keys())}

        # Save sorted JSON back to the file
        with open(file_path, "w", encoding="utf-8") as file:
            json.dump(sorted_data, file, indent=4, ensure_ascii=False)

        print(f"Successfully sorted and saved: '{file_path}'")

    except Exception as e:
        print(f"Error while processing file: '{file_path}': {e}")


def process_all_languages(base_dir):
    """
    Processes all JSON files in subdirectories corresponding to languages.

    Args:
        base_dir (str): Base directory containing language subdirectories
    """
    try:
        # List all subdirectories in the base directory
        for language_dir in os.listdir(base_dir):
            language_path = os.path.join(base_dir, language_dir)

            # Check if it's a directory
            if os.path.isdir(language_path):
                # Look for JSON files in the directory
                for file_name in os.listdir(language_path):
                    if file_name.endswith(".json"):
                        file_path = os.path.join(language_path, file_name)
                        sort_json_in_file(file_path)

    except Exception as e:
        print(f"Error while processing language directories: {e}")


if __name__ == "__main__":
    # Get the absolute path of the current script
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Define the base directory relative to the script's location
    base_directory = os.path.join(script_dir, "i18n")

    # Process all languages
    process_all_languages(base_directory)
