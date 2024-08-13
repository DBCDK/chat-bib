import { useQuery, gql } from "@apollo/client";
import {
  BEGIN_COMPONENT,
  DELIMITER,
  encodeValue,
  END_COMPONENT,
} from "../constants";
import styles from "./Carousel.module.css";

const GET_MATERIALS = gql`
  query Get_Works($workIds: [String!]!) {
    works(id: $workIds) {
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

const name = "Carousel";

function Carousel({
  workIds,
  complete,
}: {
  workIds: string[];
  complete: Boolean;
}) {
  const { loading, error, data } = useQuery(GET_MATERIALS, {
    variables: { workIds },
    skip: !complete || !workIds,
  });
  const isLoading = !complete || loading;

  return (
    <div className={styles.container}>
      {data?.works?.map((work: any) => {
        const cover = getCoverImage(work?.manifestations?.mostRelevant)?.detail;
        return (
          <div key={work.workId}>
            <a
              href={`https://bibliotek.dk/materiale/titel/${encodeURIComponent(work?.workId)}`}
              target={"_blank"}
            >
              <img src={cover} />
            </a>
          </div>
        );
      })}
    </div>
  );
}
function serialize({ say, workIds }: { say: Function; workIds: string[] }) {
  say(BEGIN_COMPONENT);
  say(encodeValue(name));
  say(DELIMITER);
  say(encodeValue(JSON.stringify(workIds)));
  say(END_COMPONENT);
}
function deserialize(parts: string[], complete: Boolean) {
  const [workIds] = parts;

  return <Carousel workIds={JSON.parse(workIds || "[]")} complete={complete} />;
}

export default {
  name,
  serialize,
  deserialize,
};
