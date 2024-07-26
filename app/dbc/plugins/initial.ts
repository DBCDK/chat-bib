import { gql } from "@apollo/client";
import { initializeApollo } from "@/app/client/apolloClient";
import { PluginContext, PluginResponse, PluginType } from ".";

const client = initializeApollo();

const SEARCH_LIBRARIES = gql`
  query Get_Branches($q: String!) {
    branches(q: $q, limit: 3) {
      hitcount
      result {
        name
        branchId
        openingHours
        postalAddress
        postalCode
      }
    }
  }
`;

async function process(
  args: string[],
  context: PluginContext,
): Promise<PluginResponse> {
  const [library, book, movie, series, conversationEnded] = args.map((f) =>
    parseFloat(f),
  );
  const PLUGINS = context.PLUGINS;

  context.init = { library, book, movie, series, conversationEnded };

  const nextPlugins = [];

  if (library > 0.5) {
    nextPlugins.push(PLUGINS.fetch_library);
  } else if (conversationEnded > 0.5) {
    nextPlugins.push(PLUGINS.conversation_over);
  } else if (book > 0.5 || movie > 0.5 || series > 0.5) {
    nextPlugins.push(PLUGINS.search);
  } else {
    nextPlugins.push(PLUGINS.ready_to_answer);
  }

  return {
    nextPlugins,
    result: "",
  };
}
const id = "init";
export default {
  id,
  minArgs: 8,
  maxArgs: 8,
  help: `${id}
Usage: ${id} LIBRARY_MENTIONED HOLDINGS_STATUS_MENTIONED CITY_MENTION BOOK_RELATED MOVIE_RELATED SERIES_MENTIONED MATERIAL_PART_OF_SERIES CONVERSATION_ENDED

A command-line tool for preparing a response to a user in a chat conversation.
It is important that you fill in the arguments very accurately, based on the conversation history, and especially the user's latest message.

Imagine you are different experts that work together to give fill out the arguments:
 1. Expert in language, semantics
 2. Expert librarian
 3. Expert in city names

Each score given as an argument has been discussed in the group of experts.

Arguments:
  LIBRARY_MENTIONED          A score that indicates the truthness of the following statement: "Did the user mention a specific library?"
                              An int from 0 to 9 where 0 is extremely low probability, and 9 is extremely high probability.

  HOLDINGS_STATUS_MENTIONED  A score that indicates the truthness of the following statement: "Did the user have interest in knowing the status of a material on a physical library?"
                              An int from 0 to 9 where 0 is extremely low probability, and 9 is extremely high probability.

  CITY_MENTION               A score that indicates the truthness of the following statement: "Did the user mention a city?"
                              An int from 0 to 9 where 0 is extremely low probability, and 9 is extremely high probability.

  BOOK_RELATED               A score indicating your confidence that the user is looking for books or other library materials.
                              An int from 0 to 9 where 0 is extremely low probability, and 9 is extremely high probability.

  MOVIE_RELATED              A score indicating your confidence that the user is looking for movies or other library materials.
                              An int from 0 to 9 where 0 is extremely low probability, and 9 is extremely high probability.

  SERIES_MENTIONED           A score that indicates the truthness of the following statement: "Did the user mention a specific series?"
                              An int from 0 to 9 where 0 is extremely low probability, and 9 is extremely high probability.
  
  MATERIAL_PART_OF_SERIES    A score that indicates the truthness of the following statement: "Is the user showing interest in material that is part of a known series"
                              An int from 0 to 9 where 0 is extremely low probability, and 9 is extremely high probability.
                          
  CONVERSATION_ENDED         A score indicating your confidence that the user ended the conversation, for instance by saying thanks and having no further questions.
                              An int from 0 to 9 where 0 is extremely low probability, and 9 is extremely high probability.

Examples, these are not messages from the current session:
  Ex. matching keywords: Ballerup Bibliotek|Hovedbiblioteket|lokale bibliotek
  ${id} 9 0 9 0 0 0 0 0 

  Example Keywords: Hjemme på|på hylden|tilgængelig hos
  ${id} 0 9 0 0 0 0 0 0 

  Ex. matching keywords: Ballerup|Århus|Odense|Jøbenhavn
  ${id} 0 0 9 0 0 0 0 0 

  Ex. matching keywords: bog|Harry Potter|Stephen King
  ${id} 0 0 0 9 0 0 0 0 

  Ex. matching keywords: film|tv
  ${id} 0 0 0 0 9 0 0 0 

  Ex. matching keywords: serie|serien|tv-serie|kollektion
  ${id} 0 0 0 0 0 9 0 0 

  Ex. matching keywords: Harry Potter|Dirty Harry
  ${id} 0 0 0 0 0 0 9 0 

  Ex. matching keywords: Tak for i dag|Farvel| Vi ses
  ${id} 0 0 0 0 0 0 0 9

  User Message: "Er bogen 'Harry Potter og De Vises Sten' tilgængelig på Hovedbiblioteket i København?"
  ${id} 9 9 9 9 0 9 9 0

  User Message: "Har I filmen 'Inception' i jeres samling?"
  ${id} 0 9 0 0 9 0 0 0

  User Message: "Jeg leder efter en ny serie at se. Har I nogen anbefalinger?"
  ${id} 0 0 0 0 9 9 0 0

  User Message: "Er bogen 'The Hobbit' en del af en serie, og er den tilgængelig i Odense?"
  ${id} 0 9 9 9 0 9 9 0

  User Message: "Findes der nogen biblioteker i Århus, der har bogen '1984' af George Orwell?"
  ${id} 9 9 9 9 0 0 0 0

  User Message: "Jeg vil gerne vide, om Hovedbiblioteket i København har filmen 'The Matrix' tilgængelig."
  ${id} 9 9 9 0 9 0 0 0

  User Message: "Jeg søger efter en bogserie til min søn. Kan du anbefale noget?"
  ${id} 0 0 0 9 0 9 9 0

  User Message: "Er tv-serien 'Game of Thrones' tilgængelig på biblioteket i Århus?"
  ${id} 9 9 9 0 9 9 9 0

  User Message: "Tak for hjælpen! Det var alt, hvad jeg havde brug for at vide."
  ${id} 0 0 0 0 0 0 0 9

  User Message: "Har I 'Lord of the Rings' trilogien tilgængelig på biblioteket i Odense?"
  ${id} 9 9 9 9 0 9 9 0

  `,
  process,
  findBestCommand: (commands: object[]) => {
    return commands[0];
    if (commands.length > 2) {
      console.log("commands", commands);
      return commands[0];
    }
  },
} as PluginType;
