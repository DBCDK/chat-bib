"use client";
import { useQuery, gql } from "@apollo/client";
import styles from "./Carousel.module.css";
import { useEffect, useState } from "react";
import { useWindowSize } from "@/app/utils";

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
          edition {
            publicationYear {
              display
            }
          }
        }
        mostRelevant {
          cover {
            origin
            detail
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

  const [selectedWork, setSelectedWork] = useState<any>(null);

  useEffect(() => {
    if (data?.works[0]) {
      setSelectedWork(data.works[0]);
    }
  }, [data]);

  const handleClick = (work: any) => {
    setSelectedWork(work);
  };

  const isLoading = !complete || loading;
  if (!workIds || workIds?.length === 0) {
    return null;
  }
  return (
    <div className={styles.container}>
      {workIds?.length > 1 && (
        <div className={styles.carousel}>
          {data?.works?.map((work: any) => {
            const cover = getCoverImage(
              work?.manifestations?.mostRelevant,
            )?.detail;
            return (
              <div
                key={work.workId}
                className={`${styles.item} ${selectedWork?.workId === work.workId ? styles.selected : ""}`}
              >
                <img
                  src={cover}
                  alt={work.titles?.main[0]}
                  onClick={() => handleClick(work)}
                  className={styles.coverImage}
                />

                {/* <p>{work.titles?.main[0]}</p> */}
              </div>
            );
          })}
        </div>
      )}
      <InfoBox selectedWork={selectedWork} />
    </div>
  );
}

function InfoBox({ selectedWork }: { selectedWork: any }) {
  const { width } = useWindowSize();
  const isSmallScreen = width < 800;
  if (!selectedWork) {
    return null;
  }

  const publicationYear =
    selectedWork?.manifestations?.latest?.edition?.publicationYear?.display;
  const link = `https://bibliotek.dk/materiale/titel/${encodeURIComponent(selectedWork?.workId)}`;
  const cover = getCoverImage(
    selectedWork?.manifestations?.mostRelevant,
  )?.detail;
  console.log("selectedWork", selectedWork);
  return (
    <div className={styles.infoBox}>
      <div className={styles.divider}></div>

      <div className={styles.infoboxContent}>
        <img
          src={cover}
          alt={selectedWork.titles?.main[0]}
          //   onClick={() => handleClick(work)}
          className={styles.coverImage}
        />

        <div>
          <h2>{selectedWork.titles?.main[0]}</h2>
          <p>{selectedWork.abstract}</p>
          {!isSmallScreen && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkButton}
            >
              Se på bibliotek.dk
            </a>
          )}
        </div>
        <div className={styles.bookInfo}>
          <p>
            <strong>
              {`Forfatter${selectedWork.creators?.length > 1 ? "e" : ""}: `}{" "}
            </strong>
            {`${selectedWork.creators?.map((creator: any) => creator.display).join(", ") || " -"}`}
          </p>
          <p>
            <strong> {`Sprog: `}</strong>
            {`${selectedWork.mainLanguages?.map((lang: any) => lang.display).join(", ") || " - "}`}
          </p>

          {
            <p>
              <strong> {`Udgivet: `} </strong>
              {`${publicationYear || " -"}`}
            </p>
          }
        </div>
        {isSmallScreen && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.linkButton}
          >
            Se på bibliotek.dk
          </a>
        )}
      </div>
    </div>
  );
}

export { Carousel, InfoBox };
