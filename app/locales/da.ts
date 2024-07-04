import { getClientConfig } from "../config/client";
import { SubmitKey } from "../store/config";

const isApp = !!getClientConfig()?.isApp;
const da = {
  WIP: "Kommer snart...",
  Error: {
    Unauthorized: isApp
      ? "Ugyldig API-nøgle, tjek venligst på [Indstillinger](/#/settings)-siden."
      : "Uautoriseret adgang, indtast venligst adgangskode på [auth](/#/auth)-siden, eller indtast din OpenAI API-nøgle.",
  },
  Auth: {
    Title: "Kræver adgangskode",
    Tips: "Indtast venligst adgangskode nedenfor",
    SubTips: "Eller indtast din OpenAI eller Google API-nøgle",
    Input: "adgangskode",
    Confirm: "Bekræft",
    Later: "Senere",
  },
  ChatItem: {
    ChatItemCount: (count: number) => `${count} beskeder`,
  },
  Chat: {
    SubTitle: (count: number) => `${count} beskeder`,
    EditMessage: {
      Title: "Rediger alle beskeder",
      Topic: {
        Title: "Emne",
        SubTitle: "Skift det aktuelle emne",
      },
    },
    Actions: {
      ChatList: "Gå til chatliste",
      CompressedHistory: "Komprimeret historik",
      Export: "Eksporter alle beskeder som Markdown",
      Copy: "Kopier",
      Stop: "Stop",
      Retry: "Prøv igen",
      Pin: "Fastgør",
      PinToastContent: "1 besked fastgjort til kontekstuelle prompts",
      PinToastAction: "Se",
      Delete: "Slet",
      Edit: "Rediger",
    },
    Commands: {
      new: "Start en ny chat",
      newm: "Start en ny chat med maske",
      next: "Næste chat",
      prev: "Forrige chat",
      clear: "Ryd kontekst",
      del: "Slet chat",
    },
    InputActions: {
      Stop: "Stop",
      ToBottom: "Til nyeste",
      Theme: {
        auto: "Auto",
        light: "Lyst tema",
        dark: "Mørkt tema",
      },
      Prompt: "Prompter",
      Masks: "Masker",
      Clear: "Ryd kontekst",
      Settings: "Indstillinger",
      UploadImage: "Upload billeder",
    },
    Rename: "Omdøb chat",
    Typing: "Skriver…",
    Input: (submitKey: string) => {
      return "Send besked til ChatBib";
      var inputHints = `${submitKey} for at sende`;
      if (submitKey === String(SubmitKey.Enter)) {
        inputHints += ", Shift + Enter for at ombryde";
      }
      return inputHints + ", / for at søge prompts, : for at bruge kommandoer";
    },
    Send: "Send",
    Config: {
      Reset: "Nulstil til standard",
      SaveAs: "Gem som maske",
    },
    IsContext: "Kontekstuel prompt",
  },
  Export: {
    Title: "Eksporter beskeder",
    Copy: "Kopier alle",
    Download: "Download",
    MessageFromYou: "Besked fra dig",
    MessageFromChatGPT: "Besked fra ChatGPT",
    Share: "Del til ShareGPT",
    Format: {
      Title: "Eksportformat",
      SubTitle: "Markdown eller PNG-billede",
    },
    IncludeContext: {
      Title: "Inkluder kontekst",
      SubTitle: "Eksporter kontekstuelle prompts i masken eller ej",
    },
    Steps: {
      Select: "Vælg",
      Preview: "Forhåndsvisning",
    },
    Image: {
      Toast: "Optager billede...",
      Modal: "Hold nede eller højreklik for at gemme billede",
    },
  },
  Select: {
    Search: "Søg",
    All: "Vælg alle",
    Latest: "Vælg seneste",
    Clear: "Ryd",
  },
  Memory: {
    Title: "Hukommelses-prompt",
    EmptyContent: "Intet endnu.",
    Send: "Send hukommelse",
    Copy: "Kopier hukommelse",
    Reset: "Nulstil session",
    ResetConfirm:
      "Nulstilling vil slette den aktuelle samtalehistorik og historisk hukommelse. Er du sikker på, at du vil nulstille?",
  },
  Home: {
    NewChat: "Ny chat",
    DeleteChat: "Bekræft sletning af den valgte samtale?",
    DeleteToast: "Chat slettet",
    Revert: "Fortryd",
  },
  Settings: {
    Title: "Indstillinger",
    SubTitle: "Alle indstillinger",
    Danger: {
      Reset: {
        Title: "Nulstil alle indstillinger",
        SubTitle: "Nulstil alle indstillinger til standard",
        Action: "Nulstil",
        Confirm: "Bekræft nulstilling af alle indstillinger til standard?",
      },
      Clear: {
        Title: "Ryd alle data",
        SubTitle: "Ryd alle beskeder og indstillinger",
        Action: "Ryd",
        Confirm: "Bekræft sletning af alle beskeder og indstillinger?",
      },
    },
    Lang: {
      Name: "Language", // ATTENTION: if you wanna add a new translation, please do not translate this value, leave it as `Language`
      All: "Alle sprog",
    },
    Avatar: "Avatar",
    FontSize: {
      Title: "Skriftstørrelse",
      SubTitle: "Juster skriftstørrelsen på chatindhold",
    },
    InjectSystemPrompts: {
      Title: "Indsæt systemprompter",
      SubTitle: "Indsæt en global systemprompt for hver forespørgsel",
    },
    InputTemplate: {
      Title: "Inputskabelon",
      SubTitle: "Nyeste besked vil blive fyldt ind i denne skabelon",
    },

    Update: {
      Version: (x: string) => `Version: ${x}`,
      IsLatest: "Nyeste version",
      CheckUpdate: "Tjek for opdatering",
      IsChecking: "Tjekker opdatering...",
      FoundUpdate: (x: string) => `Ny version fundet: ${x}`,
      GoToUpdate: "Opdater",
    },
    SendKey: "Send nøgle",
    Theme: "Tema",
    TightBorder: "Stram kant",
    SendPreviewBubble: {
      Title: "Forhåndsvisning af sendeboble",
      SubTitle: "Forhåndsvis markdown i boble",
    },
    AutoGenerateTitle: {
      Title: "Generer titel automatisk",
      SubTitle: "Generer en passende titel baseret på samtaleindholdet",
    },
    Sync: {
      CloudState: "Sidste opdatering",
      NotSyncYet: "Ikke synkroniseret endnu",
      Success: "Synkronisering lykkedes",
      Fail: "Synkronisering mislykkedes",

      Config: {
        Modal: {
          Title: "Konfigurer synkronisering",
          Check: "Tjek forbindelse",
        },
        SyncType: {
          Title: "Synkroniseringstype",
          SubTitle: "Vælg din foretrukne synkroniseringstjeneste",
        },
        Proxy: {
          Title: "Aktivér CORS Proxy",
          SubTitle: "Aktivér en proxy for at undgå CORS-begrænsninger",
        },
        ProxyUrl: {
          Title: "Proxy Endpoint",
          SubTitle:
            "Kun gældende for den indbyggede CORS-proxy til dette projekt",
        },

        WebDav: {
          Endpoint: "WebDAV Endpoint",
          UserName: "Brugernavn",
          Password: "Adgangskode",
        },

        UpStash: {
          Endpoint: "UpStash Redis REST URL",
          UserName: "Backup navn",
          Password: "UpStash Redis REST Token",
        },
      },

      LocalState: "Lokale data",
      Overview: (overview: any) => {
        return `${overview.chat} chats, ${overview.message} beskeder, ${overview.prompt} prompts, ${overview.mask} masker`;
      },
      ImportFailed: "Import fra fil mislykkedes",
    },
    Mask: {
      Splash: {
        Title: "Maskesplash-skærm",
        SubTitle: "Vis en maskesplash-skærm før start af ny chat",
      },
      Builtin: {
        Title: "Skjul indbyggede masker",
        SubTitle: "Skjul indbyggede masker i maskelisten",
      },
    },
    Prompt: {
      Disable: {
        Title: "Deaktiver autofuldførelse",
        SubTitle: "Skriv / for at udløse autofuldførelse",
      },
      List: "Promptliste",
      ListCount: (builtin: number, custom: number) =>
        `${builtin} indbyggede, ${custom} brugerdefinerede`,
      Edit: "Rediger",
      Modal: {
        Title: "Promptliste",
        Add: "Tilføj en",
        Search: "Søg i prompts",
      },
      EditModal: {
        Title: "Rediger prompt",
      },
    },
    HistoryCount: {
      Title: "Antal vedhæftede beskeder",
      SubTitle: "Antal sendte beskeder vedhæftet pr. forespørgsel",
    },
    CompressThreshold: {
      Title: "Tærskel for komprimering af historik",
      SubTitle:
        "Vil komprimere, hvis ukomprimeret længde af beskeder overskrider værdien",
    },

    Usage: {
      Title: "Kontosaldo",
      SubTitle(used: any, total: any) {
        return `Brugt denne måned $${used}, abonnement $${total}`;
      },
      IsChecking: "Tjekker...",
      Check: "Tjek",
      NoAccess: "Indtast API-nøgle for at tjekke saldo",
    },
    Access: {
      AccessCode: {
        Title: "Adgangskode",
        SubTitle: "Adgangskontrol aktiveret",
        Placeholder: "Indtast kode",
      },
      CustomEndpoint: {
        Title: "Brugerdefineret Endpoint",
        SubTitle: "Brug tilpasset Azure eller OpenAI tjeneste",
      },
      Provider: {
        Title: "Modelleverandør",
        SubTitle: "Vælg Azure eller OpenAI",
      },
      OpenAI: {
        ApiKey: {
          Title: "OpenAI API-nøgle",
          SubTitle: "Brug tilpasset OpenAI API-nøgle",
          Placeholder: "sk-xxx",
        },

        Endpoint: {
          Title: "OpenAI Endpoint",
          SubTitle:
            "Skal starte med http(s):// eller brug /api/openai som standard",
        },
      },
      Azure: {
        ApiKey: {
          Title: "Azure API-nøgle",
          SubTitle: "Tjek din API-nøgle fra Azure-konsollen",
          Placeholder: "Azure API-nøgle",
        },

        Endpoint: {
          Title: "Azure Endpoint",
          SubTitle: "Eksempel: ",
        },

        ApiVerion: {
          Title: "Azure API-version",
          SubTitle: "Tjek din API-version fra Azure-konsollen",
        },
      },
      Anthropic: {
        ApiKey: {
          Title: "Anthropic API-nøgle",
          SubTitle:
            "Brug en tilpasset Anthropic-nøgle for at omgå adgangsbegrænsninger",
          Placeholder: "Anthropic API-nøgle",
        },

        Endpoint: {
          Title: "Endpoint-adresse",
          SubTitle: "Eksempel:",
        },

        ApiVerion: {
          Title: "API-version (Claude API-version)",
          SubTitle: "Vælg og indtast en specifik API-version",
        },
      },
      CustomModel: {
        Title: "Brugerdefinerede modeller",
        SubTitle: "Brugerdefinerede modelmuligheder, adskilt af komma",
      },
      Google: {
        ApiKey: {
          Title: "API-nøgle",
          SubTitle: "Hent din API-nøgle fra Google AI",
          Placeholder: "Indtast din Google AI Studio API-nøgle",
        },

        Endpoint: {
          Title: "Endpoint-adresse",
          SubTitle: "Eksempel:",
        },

        ApiVersion: {
          Title: "API-version (specifik for Gemini-pro)",
          SubTitle: "Vælg en specifik API-version",
        },
      },
    },

    Model: "Model",
    Temperature: {
      Title: "Temperatur",
      SubTitle: "En højere værdi gør outputtet mere tilfældigt",
    },
    TopP: {
      Title: "Top P",
      SubTitle: "Ændr ikke denne værdi sammen med temperatur",
    },
    MaxTokens: {
      Title: "Maksimalt antal tokens",
      SubTitle: "Maksimal længde af inputtokens og genererede tokens",
    },
    PresencePenalty: {
      Title: "Tilstedeværelsesstraf",
      SubTitle: "En højere værdi øger sandsynligheden for at tale om nye emner",
    },
    FrequencyPenalty: {
      Title: "Frekvensstraf",
      SubTitle:
        "En højere værdi mindsker sandsynligheden for at gentage den samme linje",
    },
  },
  Store: {
    DefaultTopic: "Ny samtale",
    BotHello: "Hej! Hvordan kan jeg hjælpe dig i dag?",
    Error: "Noget gik galt, prøv venligst igen senere.",
    Prompt: {
      History: (content: string) =>
        "Dette er et resumé af chat-historikken som en genopfriskning: " +
        content,
      Topic:
        "Generér en titel på dansk, der opsummerer vores samtale uden nogen indledning, tegnsætning, anførselstegn, punktummer, symboler, fed tekst eller ekstra tekst. Fjern omsluttende anførselstegn. Skriv på dansk. Titlen må MAX 10 tegn. Brug mellemrum mellem ord.",
      Summarize:
        "Opsummer kort diskussionen i 200 ord eller mindre til brug som en prompt for fremtidig kontekst.",
    },
  },
  Copy: {
    Success: "Kopieret til udklipsholder",
    Failed: "Kopiering mislykkedes, giv venligst adgang til udklipsholder",
  },
  Download: {
    Success: "Indholdet blev downloadet til din mappe.",
    Failed: "Download mislykkedes.",
  },
  Context: {
    Toast: (x: any) => `Med ${x} kontekstuelle prompts`,
    Edit: "Nuværende chatindstillinger",
    Add: "Tilføj en prompt",
    Clear: "Kontekst ryddet",
    Revert: "Fortryd",
  },
  Plugin: {
    Name: "Plugin",
  },
  FineTuned: {
    Sysmessage: "Du er en assistent, der",
  },
  Mask: {
    Name: "Maske",
    Page: {
      Title: "Promptskabelon",
      SubTitle: (count: number) => `${count} promptskabeloner`,
      Search: "Søg skabeloner",
      Create: "Opret",
    },
    Item: {
      Info: (count: number) => `${count} prompts`,
      Chat: "Chat",
      View: "Se",
      Edit: "Rediger",
      Delete: "Slet",
      DeleteConfirm: "Bekræft sletning?",
    },
    EditModal: {
      Title: (readonly: boolean) =>
        `Rediger promptskabelon ${readonly ? "(skrivebeskyttet)" : ""}`,
      Download: "Download",
      Clone: "Klon",
    },
    Config: {
      Avatar: "Bot-avatar",
      Name: "Bot-navn",
      Sync: {
        Title: "Brug global konfiguration",
        SubTitle: "Brug global konfiguration i denne chat",
        Confirm:
          "Bekræft overskrivning af tilpasset konfiguration med global konfiguration?",
      },
      HideContext: {
        Title: "Skjul kontekstuelle prompts",
        SubTitle: "Vis ikke kontekstuelle prompts i chatten",
      },
      Share: {
        Title: "Del denne maske",
        SubTitle: "Generer et link til denne maske",
        Action: "Kopier link",
      },
    },
  },
  NewChat: {
    Return: "Tilbage",
    Skip: "Start bare",
    Title: "Vælg en persona",
    SubTitle: "Du kan vælge en persona eller starte en tom chat",
    More: "Find flere",
    NotShow: "Vis aldrig igen",
    Close: "Luk",
    EmptyChat: "Start en ny chat",

    ConfirmNoShow:
      "Bekræft deaktivering? Du kan aktivere det i indstillinger senere.",
  },

  UI: {
    Confirm: "Bekræft",
    Cancel: "Annuller",
    Close: "Luk",
    Create: "Opret",
    Edit: "Rediger",
    Export: "Eksporter",
    Import: "Import",
    Sync: "Synkronisér",
    Config: "Konfigurer",
  },
  Exporter: {
    Description: {
      Title: "Kun beskeder efter rydning af konteksten vil blive vist",
    },
    Model: "Model",
    Messages: "Beskeder",
    Topic: "Emne",
    Time: "Tid",
  },

  URLCommand: {
    Code: "Registreret adgangskode fra URL, bekræft anvendelse?",
    Settings: "Registreret indstillinger fra URL, bekræft anvendelse?",
  },
};

export type LocaleType = typeof da;

export default da;
