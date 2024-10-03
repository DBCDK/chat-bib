import styles from "./chatbib-info.module.scss";

export default [
  {
    id: "om",
    title: "ChatBib, professionel dialog – ikke borgeranvendelse",
    text: "Formålet er at igangsætte konkrete AI-eksperimenter sammen med bibliotekerne, styrke den faglige dialog og\nkritisk vurdere sprogmodellers potentialer og faldgrupper.\nSenere kan det danne basis for chatflader rettet imod borgere ovenpå biblioteksmaterialer, bibliotekernes\nviden og fakta, som bibliotekerne kan stå inde for.\nChatBib er ikke et offentligt produkt. Prototypens målgruppe er udelukkende bibliotekernes ansatte, ikke\nborgere. ChatBib er dog ikke hemmelig, så del bare linket med andre.",
  },
  {
    id: "vaer-kritisk",
    title: "Vær kritisk",
    text: "Sprogmodellerne er trænet på gigantiske datamængder. Problemet er, at sprogmodeller og data ikke altid er\npålidelige. Sprogmodellen er også kreativ og kan give svar, der er faktuelt helt forkerte. Hvis du vil bevise, at\nmodellen fejler, kan du helt sikkert finde masser af svar, som du selv kan besvare bedre gennem åbne kilder på\nnettet eller på anden vis. Du kan nemt få den til at ”lyve”. Dette gør dog ikke ChatBib ubrugelig. Der kan nemlig\nfindes masser af relevant og korrekt viden. Den skal tjene sit formål: at være et relevant eksperiment. Derfor\nopfordrer vi dig til at bruge din kritiske sans, samle erfaringer op og dele med andre. Modellen bliver helt\nsikkert bedre og bedre henad vejen. I alle tilgængelige sprogmodeller kan man få svar der er uetiske, forkerte\nog unøjagtige. Du kan hjælpe med henad vejen at fintune og indhegne modellen i ChatBib.",
  },
  {
    id: "partnere",
    title: "Hvem står bag?",
    text: "De tekniske partnere i ChatBib er DBC Digital og KOMBIT. En del biblioteksansatte har desuden allerede sagt ja\ntil at deltage i projektet.\nDBC Digital har mere end 10 års erfaring med udvikling og drift af AI-baserede systemer og machine learning. Vi\narbejder med sprogmodeller i relation til metadataskabelse, søgning, recommendere og chatgrænseflader.\nKOMBIT og DBC Digital er partnere i DSK, Dansk Sprogmodel Konsortium.\nDBC Digital arbejder sammen med flere universiteter og offentlige virksomheder i relation til AI.",
  },
  {
    id: "fbi-databrond",
    title: "Integration med FBI-databrønd",
    text: "Der er arbejdet på at gøre prototypen til en såkaldt RAG (Retrieval-Augmented-Generation), således at der søges i udvalgte dele af FBI-brønden, fx bibliotek.dk. Bibliotek.dk er den ene af de fire tilgange til ChatBib.",
  },
  {
    id: "privatliv",
    title: "Privatliv og GDPR",
    text: (
      <div>
        <p>
          ChatBib samler ikke data op om dig. Parterne bag ChatBib har et
          kompromisløst fokus på privatliv og GDPR. Sprogmodeller og Chat
          afvikles på DBCs datacentre i Danmark.
        </p>
        <p>
          ChatBib er et system baseret på AI og som bruger skal du derfor vide
          at det er en maskine du interagere med og den tekst du ser er
          genereret af AI.
        </p>
      </div>
    ),
  },

  {
    id: "fintuning",
    title: "Fintuning",
    text: "På nuværende tidspunkt er modellen ikke fintunet og opererer i sin rå form. Dette betyder, at den endnu ikke er tilpasset specifikt til vores behov og stadig er baseret på den generelle træning, den har modtaget. DBC kommer til at træne og fintune ChatBib med relevante datasæt. Vi vil også inkludere brugerfeedback. På et senere tidspunkt etableres en løsning, hvor du som bruger kan sige ja til, at dine spørgsmål, svar og feedback bliver brugt som træningssæt.",
  },
  {
    id: "energi",
    title: "Energiforbrug og bæredygtighed",
    text: "Parterne bag ChatBib er meget optaget af bæredygtighed i forhold til energianvendelse og CO2 aftryk. Et hovedproblem med de store sprogmodeller er at de både ved etablering, tuning og anvendelse kræver ressourcekrævende GPU-hardware. ChatBib vil løbende publicere information om energiforbrug. Alle DBC Digitals datacentre bruger 100% grøn strøm.",
  },
  {
    id: "teknologi",
    title: "Teknologien",
    text: (
      <div>
        <p>
          ChatBib anvender Mixtral 8*7B, en sprogmodel med 56 milliarder
          parametre, som sammen med brugerens kontekst bruges til at generere et
          svar.
        </p>
        <p>
          Mixtral og Mistral er sprogmodeller udviklet og udgivet af Mistral AI,
          et fransk firma, der har som mål at gøre sprogmodeller tilgængelige
          som åbne værktøjer, der kan bruges til gavn for samfundet uden at være
          afhængige af de traditionelle forretningsmodeller fra de store
          teknologiselskaber.
        </p>
        <p>Mixtral 8*7B kører på GPU’er i DBC Digitals datacentre.</p>
        <p>
          ChatBib omfatter også en bred pakke af AI-software, udviklet af DBC
          Digital, som ejes af KL.
        </p>
      </div>
    ),
  },
  {
    id: "getting-started",
    title: "Kom igang",
    text: (
      <div>
        <p>
          Her kan du se nogle eksempler fra de fire forskellige anvendelser. Der
          er brugt det samme eksempel på spørgsmål, og svarene giver et indtryk
          af forskellene i de fire forskellige udgaver af ChatBib.
        </p>
        <h4>ChatBib – Generel</h4>
        <p>
          Rå sprogmodel der svarer ud fra den viden der er opbygget i
          sprogmodellen
        </p>
        <div className={styles.conversation}>
          <div>
            <p className={styles.role}>ChatBib</p>
            <p className={styles.content}>
              Hej! Hvordan kan jeg hjælpe dig i dag?
            </p>
          </div>

          <div>
            <p className={styles.role}>Bruger</p>
            <p className={styles.content}>
              jeg skal skrive en opgave om krigen i Ukraine. Kan du hjælpe mig
              med at beskrive konflikten og give mig relevante kilder?
            </p>
          </div>

          <div>
            <p className={styles.role}>ChatBib</p>
            <p className={styles.content}>
              <p>
                Selvfølgelig kan jeg hjælpe dig med at beskrive konflikten i
                Ukraine og give dig relevante kilder.
              </p>

              <p>
                Konflikten i Ukraine startede i 2014, hvor russiske styrker
                annekterede den sydøstlige del af Ukraine, kendt som Crimea.
                Dette skete efter en række pro-vestlige protester i landet, der
                førte til at den pro-russiske præsident Viktor Janukovitj blev
                afsat. Som svar herpå invaderede russiske styrker Ukraine og
                erklærede Crimea for en del af Rusland.
              </p>
              <p>
                Siden da har der været en væbnet konflikt mellem ukrainske
                regeringsstyrker og prorussiske separatister i de østlige
                regioner Donetsk og Luhansk. Konflikten har ført til tusindvis
                af døde og millioner af internt forflyttede personer.
              </p>
              <p>Relevante kilder om konflikten i Ukraine omfatter:</p>
              <ol>
                <li>
                  "Ukraine Crisis: What You Need to Know" fra BBC News
                  <br />
                  (https://www.bbc.com/news/world-europe-26248275)
                </li>
                <li>
                  "The Ukraine Conflict" fra Council on Foreign Relations
                  <br />
                  (https://www.cfr.org/backgrounder/ukraine-conflict)
                </li>
                <li>
                  "Ukraine Crisis" fra The New York Times
                  <br />
                  (https://www.nytimes.com/news-event/ukraine-crisis)
                </li>
                <li>
                  "Ukraine Conflict" fra Al Jazeera
                  <br />
                  (https://www.aljazeera.com/topics/country/ukraine.html)
                </li>
                <li>
                  "Ukraine in Crisis" fra The Guardian
                  <br />
                  (https://www.theguardian.com/world/ukraine)
                </li>
              </ol>
              <p>
                Disse kilder indeholder opdaterede nyheder, analyser og
                baggrundsinformation om konflikten i Ukraine.
              </p>
            </p>
          </div>
        </div>

        <h4>ChatBib - Faktachat</h4>
        <p>Svarer med udgangspunkt i artikler fra Faktalink og giver kilder</p>
        <div className={styles.conversation}>
          <div>
            <p className={styles.role}>ChatBib</p>
            <p className={styles.content}>
              Hej! Hvordan kan jeg hjælpe dig i dag? Jeg er god til at finde
              information fra Faktalink.
            </p>
          </div>

          <div>
            <p className={styles.role}>Bruger</p>
            <p className={styles.content}>
              jeg skal skrive en opgave om krigen i Ukraine. Kan du hjælpe mig
              med at beskrive konflikten og give mig relevante kilder?
            </p>
          </div>

          <div>
            <p className={styles.role}>ChatBib</p>
            <p className={styles.content}>
              <p>
                Krigen i Ukraine begyndte i 2014, da den russiske præsident
                Vladimir Putin annekterede den ukrainske halvø Krim. Dette skete
                efter en længere konflikt om, hvorvidt Ukraine skulle vende sig
                mod Vesten eller mod Rusland. Krim-krisen blev begyndelsen på en
                blodig konflikt i den sydøstlige del af Ukraine, som foreløbig
                kulminerede med Ruslands invasion af Ukraine i februar 2022.
              </p>
              <p>
                Konflikten har rødder tilbage til historien om Ukraine og
                Rusland, hvor de to lande har en flettet og blodig fortid. For
                Putin bør de to lande høre sammen i fremtiden, mens millioner af
                ukrainere, et flertal af Vestens lande og selv en del russere er
                dybt uenige i dette synspunkt.
              </p>
              <p>
                Her er nogle relevante kilder, som du kan bruge til at skrive
                din opgave:
              </p>
              <ol>
                <li>
                  DR Nyheder: "Forstå Ukraines blodige fortid"
                  <br />
                  (https://www.dr.dk/nyheder/udland/forsta-ukraines-blodige-fortid)
                </li>
                <li>
                  DR Nyheder: "Konflikten i Ukraine på 100 sekunder: Forstå
                  Europas glemte krig"
                  <br />
                  (https://www.dr.dk/nyheder/video/konflikten-i-ukraine-paa-100-sekunder-forsta-europas-glemte-krig_105764
                </li>
                <li>
                  Berlingske: "Krim-krisen: Hvad skete der, og hvorfor?"
                  <br />
                  (https://www.berlingske.dk/internationalt/krim-krisen-hvad-skete-der-og-hvorfor)
                </li>
                <li>
                  Politiken: "Krim-krisen: Hvad skete der, og hvorfor?"
                  <br />
                  (https://politiken.dk/udland/art6861687/Krim-krisen-Hvad-skete-der-og-hvorfor)
                </li>
              </ol>
              <p>
                Jeg håber, at dette hjælper dig med at skrive din opgave. Hvis
                du har flere spørgsmål, kan du gerne stille dem.
              </p>
              <p>Kilder:</p>

              <ul>
                <li>
                  <a href="https://faktalink.dk/artiklen-midlertidigt-utilgaengelig">
                    Krim-krisen
                  </a>
                </li>
                <li>
                  <a href="https://faktalink.dk/Krigen-i-ukraine">
                    Krigen i Ukraine
                  </a>
                </li>
              </ul>
            </p>
          </div>
        </div>
        <h4>ChatBib - Bibliotek.dk</h4>
        <p>
          Bibliotekssøgning gennem FBI-API der svarer ved at lave søgninger i
          bibliotek.dk
        </p>
        <div className={styles.conversation}>
          <div>
            <p className={styles.role}>ChatBib</p>
            <p className={styles.content}>
              Hej! Hvordan kan jeg hjælpe dig i dag? Jeg kan give anbefalinger
              og søge efter værker på bibliotek.dk.
            </p>
          </div>

          <div>
            <p className={styles.role}>Bruger</p>
            <p className={styles.content}>
              jeg skal skrive en opgave om krigen i Ukraine. Kan du hjælpe mig
              med at beskrive konflikten og give mig relevante kilder?
            </p>
          </div>

          <div>
            <p className={styles.role}>ChatBib</p>
            <p className={styles.content}>
              <p>Fuldført.</p>
              <p>
                Jeg kan anbefale følgende værker, som beskriver konflikten i
                Ukraine:
              </p>
              <ol>
                <li>
                  Titlen: "Krigen i Ukraine" af René Bank Isager, workId:
                  "work-of:870970-basis:136014749"
                </li>
                <li>
                  Titlen: "Krigen i Ukraine" af Iben Bjørnsson, workId:
                  "work-of:870971-faktalink:138327043"
                </li>
                <li>
                  Titlen: "Ruslands tusmørkeår" af Poul Funder Larsen, workId:
                  "work-of:870970-basis:135464112"
                </li>
                <li>
                  Titlen: "Krigen indeni" af Matilde Kimer, workId:
                  "work-of:870970-basis:52557364"
                </li>
                <li>
                  Titlen: "Hellige Ukraine" af Emil Bjørn Hilton Saggau, workId:
                  "work-of:870970-basis:137813815"
                </li>
              </ol>
            </p>
          </div>
        </div>

        <h4>ChatBib - Websøgning</h4>
        <p>Websøgning gennem Brave-API der svarer ved at søge på Nettet</p>
        <div className={styles.conversation}>
          <div>
            <p className={styles.role}>ChatBib</p>
            <p className={styles.content}>
              Hej! Hvordan kan jeg hjælpe dig i dag? Jeg er god til at finde
              information på internettet.
            </p>
          </div>

          <div>
            <p className={styles.role}>Bruger</p>
            <p className={styles.content}>
              jeg skal skrive en opgave om krigen i Ukraine. Kan du hjælpe mig
              med at beskrive konflikten og give mig relevante kilder
            </p>
          </div>

          <div>
            <p className={styles.role}>ChatBib</p>
            <p className={styles.content}>
              <p className={styles.actions}>
                Undersøger forespørgsel... <br />
                Laver søgestrenge... <br />
                Søger på: Krigen i Ukraine konflikt beskrivelse... <br />
                Søger på: Relevante kilder om krigen i Ukraine... <br /> Færdig.
              </p>
              <p>
                Krigen i Ukraine startede den 22. februar 2022, da Rusland
                invaderede Ukraine. Ukraine har mødt den russiske invasion med
                modstand og har fået støtte fra særligt fra EU og USA i form af
                sanktioner mod Rusland og fra adskillige lande i NATO i form af
                våben. Krigen har på flere områder ført til det modsatte
                resultat af Putins oprindelige dagsorden: Dels har krigen
                trukket ud, hvor det var tænkt som en hurtig operation, dels har
                det fået vestlige lande til at rykke sammen og opruste.
              </p>
              <p>Relevante kilder:</p>
              <ul>
                <li>
                  <a href="https://faktalink.dk/Krigen-i-ukraine">
                    https://faktalink.dk/Krigen-i-ukraine
                  </a>
                </li>
                <li>
                  <a href="https://danmarkshistorien.dk/vis/materiale/krigen-i-ukraine-og-anvendelsen-af-fortaellinger-om-2-verdenskrig">
                    https://danmarkshistorien.dk/vis/materiale/krigen-i-ukraine-og-anvendelsen-af-fortaellinger-om-2-verdenskrig
                  </a>
                </li>
                <li>
                  <a href="https://www.diis.dk/publikationer/kolde-krig-krigen-terror-krigen-ukraine-konfliktbundter-goer-konfliktloesning">
                    https://www.diis.dk/publikationer/kolde-krig-krigen-terror-krigen-ukraine-konfliktbundter-goer-konfliktloesning
                  </a>
                </li>
                <li>
                  <a href="https://www.dr.dk/nyheder/udland/tema/krigen-i-ukraine">
                    https://www.dr.dk/nyheder/udland/tema/krigen-i-ukraine
                  </a>
                </li>
                <li>
                  <a href="https://globalis.dk/konflikter/ukraine">
                    https://globalis.dk/konflikter/ukraine
                  </a>
                </li>
              </ul>
              <p>Kilder:</p>
              <ul>
                <li>
                  <a href="https://faktalink.dk/Krigen-i-ukraine">
                    https://faktalink.dk/Krigen-i-ukraine
                  </a>
                  <b />
                  <p>
                    Krigen i Ukraine er inde i sit tredje år. Og der er er
                    stadig ikke udsigt til en fredelig løsning på...
                  </p>
                </li>
                <li>
                  <a href="https://danmarkshistorien.dk/vis/materiale/krigen-i-ukraine-og-anvendelsen-af-fortaellinger-om-2-verdenskrig">
                    https://danmarkshistorien.dk/vis/materiale/krigen-i-ukraine-og-anvendelsen-af-fortaellinger-om-2-verdenskrig
                  </a>
                  <b />
                  <p>
                    I den officielle fortælling blev mange forhold fortiet – og
                    særligt forhold, der var relevante for U...
                  </p>
                </li>
                <li>
                  <a href="https://www.diis.dk/publikationer/kolde-krig-krigen-terror-krigen-ukraine-konfliktbundter-goer-konfliktloesning">
                    https://www.diis.dk/publikationer/kolde-krig-krigen-terror-krigen-ukraine-konfliktbundter-goer-konfliktloesning
                  </a>
                  <b />
                  <p>
                    Krigen mod terror havde mange fællestræk med Den Kolde Krig,
                    hvor konflikter over alt i verden blev ...
                  </p>
                </li>
                <li>
                  <a href="https://www.dr.dk/nyheder/udland/tema/krigen-i-ukraine">
                    https://www.dr.dk/nyheder/udland/tema/krigen-i-ukraine
                  </a>
                  <b />
                  <p>
                    Følg udviklingen: Her får du de seneste nyheder om krigen i
                    Ukraine. Vi holder dig opdateret med art...
                  </p>
                </li>
                <li>
                  <a href="https://globalis.dk/konflikter/ukraine">
                    https://globalis.dk/konflikter/ukraine
                  </a>
                  <b />
                  <p>
                    Den 24. februar sidste år indledte Rusland en storstilet
                    invasion af Ukraine. Angrebet var en klar o...
                  </p>
                </li>
              </ul>
            </p>
          </div>
        </div>
      </div>
    ),
  },
];
