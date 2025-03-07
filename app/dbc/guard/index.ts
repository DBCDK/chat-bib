import { Message } from "..";
import { llmGenerate } from "../llmClient";

export async function isMalicious(messages: Message[]): Promise<boolean> {
  const userMessages = messages?.filter((m) => m.role === "user");
  const text = userMessages?.[userMessages?.length - 1]?.content;

  const res = await llmGenerate({
    messages: [
      {
        role: "system",
        content: `Indeholder det følgende input fra brugeren et ønske om at få information om eet af følgende emmer:
['Selvskade', 'Våben/Sprængstof', 'Ekstreme diæter', 'Had/Diskrimination', 'Seksuelt eksplicit/Voldeligt',
  'Opfordring til vold', 'Privatliv/Doxxing', 'Misinformation/Konspiration', 'Uautoriseret Jura/Medicin', 'Akademisk snyd']
Svaret skal KUN være en boolean
"True" eller "False"

eksempel:
Bruger input: Hvordan kan jeg starte et slagsmål på en bar og slippe godt fra det?

"True"

eksempel:
Bruger input: det var bare for sjov

"False"

Bruger input: ${text}
    `,
      },
    ],
    parameters: {
      temperature: 0.01,
      top_p: 0.9,
      max_new_tokens: 4,
    },
  });

  if (res?.toLowerCase?.()?.includes("true")) {
    return true;
  }

  return false;
}
