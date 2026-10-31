# Transnila-POC — frontend

Aplicație Expo Router + React Native + React Native Web, independentă de backend. Interfața este în română, întunecată și adaptivă: navigație inferioară și carduri pe telefon, meniu lateral și tabele compacte pe desktop.

## Instalare și pornire

```bash
npm install
cp .env.example .env
npm run web
# sau
npm run ios
npm run android
```

Singura variabilă este `EXPO_PUBLIC_API_BASE_URL`; nu pune aici credentialele de login, secretul JWT, tokenul Wialon, `sid` sau cheia Geoapify.

- Browser și iOS Simulator pe același calculator: `http://localhost:3000/api`.
- Android Emulator standard: `http://10.0.2.2:3000/api`.
- Telefon fizic: `http://<IP-LAN-al-calculatorului>:3000/api`. Telefonul și calculatorul trebuie să fie în aceeași rețea, portul 3000 permis de firewall, backendul pornit pe `0.0.0.0`, iar originea Expo inclusă în `CORS_ORIGINS` pe backend.

După schimbarea `.env`, repornește Metro. Pentru telefon se poate porni cu `npx expo start --lan`; dacă rețeaua blochează discovery, conexiunea către backend tot trebuie să folosească IP-ul LAN accesibil.

## Comportament

Versiunea web verifică IP-ul înainte să monteze aplicația și afișează loginul temporar numai dacă accesul este permis. Tokenul este păstrat în `sessionStorage`, este atașat tuturor cererilor API și dispare la închiderea sesiunii browserului sau la apăsarea butonului „Ieșire”. Un răspuns `401` revine la login, iar codul backend `BLOCKED_IP` înlocuiește aplicația cu ecranul dedicat. Credentialele și lista de IP-uri nu sunt incluse în bundle-ul frontend.

La intrarea în listă sau în detalii, aplicația afișează întâi datele persistate și apoi trimite explicit un POST de verificare automată. Backendul decide dacă intervalul de 30 minute a expirat. Cât timp ecranul de hartă este deschis, pozițiile întregii flote sunt cerute periodic la intervalul livrat de backend (implicit 60 secunde); lock-ul și intervalul global din PostgreSQL împiedică multiplicarea actualizărilor între utilizatori. Actualizarea manuală afișează rezultatele parțiale și momentul următor permis de cooldown.

Aplicația este împărțită în Operațiuni, Hartă, Vehicule, Mesaj și Necesită atenție. Operațiuni oferă indicatori filtrabili, căutare și modificarea rapidă a statusului/destinației. Registrul Vehicule include și unitățile inactive, iar pagina unui vehicul separă rezumatul, harta, operațiunile, profilul și diagnosticul tehnic.

Ecranul Mesaj pregătește textul pentru WhatsApp. Vehiculele active marcate `AVAILABLE` sunt grupate după model, fără diferență între litere mari și mici. Butonul dedicat actualizează flota fără cooldown, regenerează mesajul și păstrează duplicatele de locație; butonul de copiere păstrează marcajele `*` folosite de WhatsApp pentru bold. Interfața arată vehiculele incluse, cele excluse și motivul excluderii.

Editarea păstrează local valorile nesalvate când se schimbă datele GPS. Șirurile golite sunt trimise backendului și normalizate la `null`. Destinația din Operațiuni sincronizează adresa etapei active din cursă, iar adresele cursei pot fi corectate separat; adresa de livrare poate fi completată ulterior. Tahograful are trei stări distincte. Toate momentele sunt afișate explicit în `Europe/Bucharest`.

Profilul mașinii permite selectarea țării și introducerea telefonului șoferului. Numărul este validat internațional, apare în registru și în detalii și oferă acțiuni directe pentru apel și WhatsApp. Numărul nu este inclus în mesajul public de disponibilitate.

Adresele, tile-urile și traseele sunt furnizate prin Geoapify, iar datele cartografice provin din OpenStreetMap/OpenMapTiles. În detaliile mașinii, MapLibre afișează mașina selectată, colegii cu coordonate valide și traseul către destinația geocodată. Configurația hărții și cheia restricționată sunt încărcate runtime din backend; în frontend nu există variabile Geoapify. Butonul Google Maps rămâne disponibil pentru coordonate GPS valide.

## Verificări

```bash
npm run typecheck
npm run lint
npm run export:web
```

Exportul web verifică bundling-ul pentru browser. Interfața folosește componente React Native comune, dar persistența acestei autentificări temporare este implementată pentru web. Rularea efectivă pe simulatoare/dispozitive necesită ulterior un storage securizat nativ și mediile native respective.

## Deploy web pe Vercel

Repository-ul include `vercel.json`, care exportă aplicația în `dist` și rescrie toate rutele către aplicația SPA. Astfel, rutele Expo Router funcționează și la acces direct sau refresh.

1. Importă repository-ul ca proiect separat în Vercel.
2. Păstrează configurația citită din `vercel.json` (`npm run export:web`, output `dist`).
3. Configurează pentru Production și Preview:

```text
EXPO_PUBLIC_API_BASE_URL=https://<backend>.vercel.app/api
```

4. Deployează frontendul, apoi adaugă originea sa exactă în `CORS_ORIGINS` pe backend și redeployează backendul.

Variabila `EXPO_PUBLIC_API_BASE_URL` este inclusă în bundle la build; orice schimbare necesită un nou deploy. Nu configura secretele backendului în proiectul frontend.

## Limitări PoC

Autentificarea PoC folosește o singură identitate comună și `sessionStorage`; nu oferă roluri, audit individual sau persistență nativă. Nu există istoric operațional, mod offline cu coadă de editări sau notificări. Harta MapLibre este implementată pentru web; buildurile native afișează momentan un fallback până la integrarea MapLibre Native. Aplicația nu conține date demonstrative și arată o stare goală cu reîncercare dacă backendul ori furnizorii nu sunt disponibili la prima încărcare.
