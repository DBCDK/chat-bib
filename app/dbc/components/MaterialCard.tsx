import {
  BEGIN_COMPONENT,
  DELIMITER,
  encodeValue,
  END_COMPONENT,
} from "./constants";

const name = "MaterialCard";

function MaterialCard({
  workId,
  complete,
}: {
  workId: string;
  complete: Boolean;
}) {
  if (!complete) {
    return null;
  }
  return (
    <a
      href="https://bibliotek.dk/materiale/kvaeler-krimi_kim-faber/work-of:870970-basis:39185474"
      target={"_blank"}
    >
      <div
        style={{
          width: 200,
          padding: 24,
          margin: 24,
          background: "rgb(100 91 91)",
        }}
      >
        <div>
          <img src="https://moreinfo.addi.dk/2.11/more_info_get.php?lokalid=134575174&attachment_type=forside_stor&bibliotek=870970&source_id=150020&key=8c9a89b44a9fe27904e5" />
        </div>
        <div style={{ fontSize: 14, color: "white" }}>
          En række kvinder bliver fundet kvalt i København.
        </div>
      </div>
    </a>
  );
}
function serialize({ say, workId }: { say: Function; workId: string }) {
  say(BEGIN_COMPONENT);
  say(encodeValue(name));
  say(DELIMITER);
  say(encodeValue(workId));
  say(END_COMPONENT);
}
function deserialize(parts: string[], complete: Boolean) {
  const [workId] = parts;
  return <MaterialCard workId={workId} complete={complete} />;
}

export default {
  name,
  serialize,
  deserialize,
};
