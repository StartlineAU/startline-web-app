declare global {
  interface Window {
    google?: typeof google;
  }

  namespace google {
    namespace maps {
      namespace places {
        interface PlaceResult {
          address_components?: google.maps.GeocoderAddressComponent[];
          name?: string;
          formatted_address?: string;
        }

        interface AutocompleteOptions {
          componentRestrictions?: { country: string };
          fields?: string[];
          types?: string[];
        }

        class Autocomplete {
          constructor(input: HTMLInputElement, opts?: AutocompleteOptions);
          addListener(event: string, callback: () => void): void;
          getPlace(): PlaceResult;
        }
      }

      interface GeocoderAddressComponent {
        long_name: string;
        short_name: string;
        types: string[];
      }
    }
  }
}

export {};
