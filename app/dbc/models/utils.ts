/**
 * Extracts a JSON object from a given text.
 *
 * @param text - The input text to extract the JSON object from.
 * @returns The extracted JSON object, or null if no JSON object is found or if parsing fails.
 */
export function extractJsonFromText(text: string) {
  // Regular expression to find JSON object in the input string, accounting for possible newlines and spaces
  const jsonRegex = /{[^]*}/;

  // Use the regex to extract the JSON object string
  const jsonString = text.match(jsonRegex);

  if (jsonString) {
    try {
      // Parse the JSON string into an object
      const jsonObject = JSON.parse(jsonString[0]);
      return jsonObject;
    } catch (error) {
      console.error("Failed to parse JSON:", error);
      return null;
    }
  } else {
    console.error("No JSON object found in the input string.");
    return null;
  }
}
