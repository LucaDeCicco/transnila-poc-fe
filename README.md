# Transnila-POC — frontend

Aplicație Expo Router + React Native + React Native Web, independentă de backend. Interfața este în română, întunecată și trece de la carduri pe telefon la rânduri compacte pe desktop.

## Instalare și pornire

```bash
npm install
cp .env.example .env
npm run web
# sau
npm run ios
npm run android
```

Singura variabilă este `EXPO_PUBLIC_API_BASE_URL`; nu pune aici tokenul Wialon, `sid` sau cheia Geoapify.

- Browser și iOS Simulator pe același calculator: `http://localhost:3000/api`.
- Android Emulator standard: `http://10.0.2.2:3000/api`.
- Telefon fizic: `http://<IP-LAN-al-calculatorului>:3000/api`. Telefonul și calculatorul trebuie să fie în aceeași rețea, portul 3000 permis de firewall, backendul pornit pe `0.0.0.0`, iar originea Expo inclusă în `CORS_ORIGINS` pe backend.

După schimbarea `.env`, repornește Metro. Pentru telefon se poate porni cu `npx expo start --lan`; dacă rețeaua blochează discovery, conexiunea către backend tot trebuie să folosească IP-ul LAN accesibil.

## Comportament

La intrarea în listă sau în detalii, aplicația afișează întâi datele persistate și apoi trimite explicit un POST de verificare automată. Backendul decide dacă intervalul de 30 minute a expirat. Nu există polling sau refresh în fundal; un ecran rămas deschis nu se actualizează singur. Actualizarea manuală afișează rezultatele parțiale și momentul următor permis de cooldown.

Editarea păstrează local valorile nesalvate când se schimbă datele GPS. Șirurile golite sunt trimise backendului și normalizate la `null`. Tahograful are trei stări distincte. Toate momentele sunt afișate explicit în `Europe/Bucharest`.

Adresele sunt furnizate prin Geoapify și datele cartografice OpenStreetMap; atribuirea este afișată în secțiunea locației. Butonul Google Maps folosește numai coordonatele GPS valide.

## Verificări

```bash
npm run typecheck
npm run lint
npm run export:web
```

Exportul web verifică bundling-ul pentru browser. Compatibilitatea iOS/Android este susținută de componente React Native comune; rularea efectivă pe simulatoare/dispozitive necesită mediile native respective și un backend configurat.

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

Nu există autentificare, căutare, filtre, hartă integrată, mod offline cu coadă de editări sau notificări. Aplicația nu conține date demonstrative și arată o stare goală cu reîncercare dacă backendul ori furnizorii nu sunt disponibili la prima încărcare.
