import { useQuery, gql } from "@apollo/client";
import {
  BEGIN_COMPONENT,
  DELIMITER,
  encodeValue,
  END_COMPONENT,
} from "../constants";
import styles from "./MaterialCard.module.css";

const GET_MATERIAL = gql`
  query Get_Work($workId: String!) {
    work(id: $workId) {
      workId
      titles {
        main
      }
      abstract
      creators {
        display
      }
      subjects {
        dbcVerified {
          display
          ... on SubjectText {
            language {
              display
              isoCode
            }
          }
          type
        }
      }
      workYear {
        year
        endYear
        frequency
      }
      workTypes
      mainLanguages {
        display
      }
      manifestations {
        latest {
          pid
          cover {
            detail
          }
        }
        mostRelevant {
          cover {
            origin
            detail
          }
          materialTypes {
            materialTypeSpecific {
              code
            }
          }
        }
      }
    }
  }
`;

export function getCoverImage(manifestations = []) {
  // const m = getManifestationsWithCorrectCover(manifestations);

  // console.log("hest", m);
  // Create copy, so we don't mutate the original list,
  // which leads to all sorts of fun bugs
  manifestations = [...manifestations] as any;
  const manifestationWithCover: any =
    manifestations
      ?.sort(sortByMaterialtype)
      ?.find(
        (manifestation: any) => manifestation?.cover?.origin === "moreinfo",
      ) ||
    manifestations?.find((manifestation: any) => manifestation?.cover?.detail);
  return manifestationWithCover
    ? {
        detail: manifestationWithCover?.cover?.detail,
        origin: manifestationWithCover?.cover?.origin,
        thumbnail: manifestationWithCover?.cover?.thumbnail,
      }
    : { detail: null };
}

/**
 * We want coverimages for BOOK or EBOOK first in list
 * @param a

 */
function sortByMaterialtype(a: any) {
  if (
    !!a?.materialTypes?.find(
      (mat: any) =>
        mat.materialTypeSpecific?.code === "BOOK" ||
        mat.materialTypeSpecific?.code === "EBOOK",
    )
  ) {
    return -1;
  }

  return 0;
}

const name = "MaterialCard";

function MaterialCard({
  workId,
  complete,
}: {
  workId: string;
  complete: Boolean;
}) {
  const { loading, error, data } = useQuery(GET_MATERIAL, {
    variables: { workId },
    skip: !complete || !workId,
  });
  const isLoading = !complete || loading;

  const work = data?.work;
  const cover = getCoverImage(work?.manifestations?.mostRelevant)?.detail;

  return (
    <div className={styles.card}>
      {!isLoading && <img src={cover} />}
      {!isLoading && (
        <div className={styles.content}>
          <a
            href={`https://bibliotek.dk/materiale/titel/${encodeURIComponent(work?.workId)}`}
            target={"_blank"}
          >
            <h2>{work?.titles?.main}</h2>
          </a>

          <p className={styles.creators}>
            {work?.creators
              ?.map((creator: any) => creator?.display)
              ?.join(", ")}
          </p>

          <p className={styles.abstract}>{work?.abstract}</p>
        </div>
      )}
    </div>
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
