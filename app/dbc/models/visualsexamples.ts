import { CustomModel, GenerateRequest } from "..";

import ExampleComponent from "../components/ExampleComponent";
import MaterialCard from "../components/MaterialCard/MaterialCard";

async function generate({ messages, say, close }: GenerateRequest) {
  if (messages?.[messages?.length - 1]?.role !== "user") {
    say({ generated_text: "Lad os se på det jajaja" });
    close();
    return;
  }
  say("Lad os se på det");

  ExampleComponent.serialize({
    say,
    title: "Smukt digt",
    description: "En lille mand gik en tur, det var bar' så godt.",
  });

  say("Smukt, ik? Jeg har brugt lang tid på det..");

  MaterialCard.serialize({ say, workId: "work-of:870970-basis:39185474" });
  say("Tjek den ud ☝️, hvis du er til en uhyggelig krimi\n\n\n");
  MaterialCard.serialize({ say, workId: "work-of:870970-basis:138462455" });
  say("Eller måske er du mere til noget trist?");

  close();
}

export default {
  generate,
} as CustomModel;
