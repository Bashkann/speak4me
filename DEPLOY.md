# Production deployment runbook

Bu runbook Speak Four'u aşağıdaki sabit mimariyle yayınlamak içindir:

- Ses/WebRTC: LiveKit Cloud
- API ve PostgreSQL: Railway, tek ve sürekli çalışan API instance'ı
- Statik React/Vite frontend: Vercel

Bu dosyadaki `YOUR-*` değerleri gerçek değerlerle değiştirilmelidir. Gerçek secret'ları Git'e, Vercel'e veya frontend'de `VITE_*` değişkenlerine koymayın. Frontend'e verilen her `VITE_*` değeri public bundle'ın parçasıdır.

## 0. Yayından önce

1. Son commitleri GitHub repository'nize push edin.
2. Yerelde doğrulayın:

   ```bash
   npm ci
   npm run build
   npm test
   npm ci --prefix frontend
   VITE_API_URL=https://api.example.com/api npm run build --prefix frontend
   npm run test --prefix frontend
   ```

3. Birbirinden farklı iki JWT secret üretin; çıktıları yalnız Railway'e kaydedin:

   ```bash
   openssl rand -base64 48
   openssl rand -base64 48
   ```

4. `.env.production.example` ve `frontend/.env.production.example` dosyalarını değişken kontrol listesi olarak kullanın. Örnek değerleri production değeri olarak bırakmayın.

API'nin matchmaking presence bilgisi ve oda timer'ları process belleğindedir. Bu nedenle API her zaman **tam olarak bir replica** ile ve **Serverless/App Sleeping kapalı** çalışmalıdır. İkinci replica aynı odanın timer'larını bağımsız çalıştırabilir; uyuyan bir instance ise aktif timer ve socket bağlantılarını kaybeder.

## 1. LiveKit Cloud

1. [LiveKit Cloud dashboard](https://cloud.livekit.io/) içinde Build planında bir proje oluşturun.
2. Project Settings içinden şu üç değeri alın:
   - Project URL: `wss://...livekit.cloud`
   - API key
   - API secret
3. Bunları yalnız Railway backend service değişkenlerinde sırasıyla `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` olarak kullanın. `LIVEKIT_PUBLIC_URL` değerini de aynı `wss://` Project URL yapın.
4. URL, key ve secret'ın aynı LiveKit projesinden geldiğini kontrol edin. LiveKit'in resmi CLI dokümanı Cloud Project URL'nin `wss://` ile başladığını doğrular: [LiveKit Cloud project credentials](https://docs.livekit.io/reference/developer-tools/livekit-cli/).

Build planı aylık yaklaşık **5.000 WebRTC participant-minute** içerir ve 100 eşzamanlı participant sınırına sahiptir. Dört kişinin yedi dakika bağlı kaldığı bir test yaklaşık 28 participant-minute tüketir. Build planında kota sert sınırdır; güncel değerleri her zaman dashboard'dan kontrol edin: [LiveKit quotas and limits](https://docs.livekit.io/deploy/admin/quotas-and-limits/).

Production'da repository'deki local LiveKit container'ını kullanmayın.

## 2. Railway: PostgreSQL ve backend

### 2.1 Projeyi ve servisleri oluşturun

1. Railway'de yeni bir proje açın.
2. **Deploy from GitHub repo** seçeneğiyle bu repository'yi seçin. Backend service için Root Directory repository kökü olarak kalmalıdır.
3. Aynı project canvas'ta **New → Database → PostgreSQL** ekleyin. Railway'in resmi PostgreSQL akışı `DATABASE_URL` dahil bağlantı değişkenlerini üretir: [Railway PostgreSQL](https://docs.railway.com/databases/postgresql).
4. PostgreSQL servisi `Postgres` adını taşımıyorsa aşağıdaki reference variable içindeki servis adını gerçek adla değiştirin.

İlk backend deploy'u değişkenler eksikken fail ederse bu beklenen ve güvenli davranıştır; uygulama eksik production config ile açılmaz.

### 2.2 Backend environment variables

Backend service → **Variables → Raw Editor** bölümüne aşağıdaki listeyi yapıştırın ve placeholder'ları değiştirin:

```dotenv
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
CORS_ORIGIN=https://YOUR-PROJECT.vercel.app
JWT_ACCESS_SECRET=PASTE_FIRST_48_BYTE_RANDOM_VALUE
JWT_REFRESH_SECRET=PASTE_SECOND_48_BYTE_RANDOM_VALUE
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30
LIVEKIT_URL=wss://YOUR-PROJECT.livekit.cloud
LIVEKIT_PUBLIC_URL=wss://YOUR-PROJECT.livekit.cloud
LIVEKIT_API_KEY=PASTE_LIVEKIT_API_KEY
LIVEKIT_API_SECRET=PASTE_LIVEKIT_API_SECRET
MATCHMAKING_INTERVAL_MS=3000
MATCHMAKING_WIDEN_AFTER_SEC=120
READY_COUNTDOWN_SEC=5
ROUND_BREAK_SEC=20
RECONNECT_GRACE_SEC=45
DEFAULT_ROUND_DURATION_SEC=420
LOG_LEVEL=info
```

Railway `PORT` değişkenini otomatik sağlar; sabit bir public port yazmayın. `CORS_ORIGIN` şimdilik planladığınız Vercel production origin'idir. Vercel gerçek domain'i verdikten sonra 4. bölümde kesin değeri yazacaksınız. Birden fazla kalıcı frontend origin'i gerekiyorsa virgülle ayırın; wildcard kullanmayın:

```dotenv
CORS_ORIGIN=https://app.example.com,https://www.example.com
```

Railway reference variable kullanımı database adresi değiştiğinde backend değerini güncel tutar: [Railway variables](https://docs.railway.com/variables).

### 2.3 Deploy ve runtime ayarları

Repository kökündeki `railway.json` şunları uygular:

- Root `Dockerfile` ile build
- Deploy canlıya alınmadan `npm run db:migrate` (`prisma migrate deploy`)
- `npm start` ile API boot
- `/healthz` health check
- `numReplicas: 1`

Railway'in config-as-code şeması ve pre-deploy komutu resmi olarak desteklenir: [config as code](https://docs.railway.com/config-as-code), [pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command).

Backend service ayarlarında ayrıca şunları elle doğrulayın:

1. **Replicas = 1**. Bunu artırmayın.
2. **Serverless/App Sleeping = disabled**. Bu uygulama cold start/sleep ile doğru çalışmaz.
3. Root Directory `/`, config file path `/railway.json` ve Dockerfile path `Dockerfile`.
4. Networking → **Generate Domain** ile HTTPS public backend domain'i oluşturun.
5. Deploy loglarında `prisma migrate deploy` başarıyla tamamlanmalı, sonra API health check geçmelidir.

Kontrol:

```bash
curl --fail https://YOUR-BACKEND.up.railway.app/healthz
```

Beklenen gövde:

```json
{"status":"ok"}
```

Railway Serverless, inaktif servisi uyutup ilk istekte cold boot/502 üretebilir; bu nedenle bu projede kapalı kalmalıdır: [Railway Serverless caveats](https://docs.railway.com/deployments/serverless).

### 2.4 Topic seed ve ilk admin — yalnız bir kez

Production start komutu seed çalıştırmaz. Bu kasıtlıdır. Önce backend service Variables'a geçici olarak şunları ekleyin:

```dotenv
SEED_ADMIN_EMAIL=YOUR-REAL-ADMIN@example.com
SEED_ADMIN_PASSWORD=USE_A_UNIQUE_PASSWORD_WITH_12_OR_MORE_CHARACTERS
SEED_ADMIN_DISPLAY_NAME=Speak Four Admin
```

Değişken değişikliklerini deploy edin. Ardından Railway dashboard'da backend servisine sağ tıklayıp **Copy SSH Command** seçin, verilen komutla container'a girin ve çalıştırın:

```bash
npm run db:seed:production
exit
```

Bu komut 30 konuşma topic'ini ve yalnız verdiğiniz ilk admin hesabını idempotent biçimde oluşturur; demo hesapları oluşturmaz. Başarıdan sonra `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_EMAIL` ve `SEED_ADMIN_DISPLAY_NAME` değişkenlerini Railway'den silip değişikliği deploy edin. Railway'in deployed container SSH desteği: [railway ssh](https://docs.railway.com/cli/ssh).

## 3. Vercel: frontend

1. Vercel'de **Add New → Project** ile aynı GitHub repository'sini import edin.
2. Ayarları şu şekilde seçin:
   - Root Directory: `frontend`
   - Framework Preset: `Vite`
   - Install Command: `npm ci`
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. Production environment variable ekleyin:

   ```dotenv
   VITE_API_URL=https://YOUR-BACKEND.up.railway.app/api
   ```

4. Deploy edin. `frontend/vercel.json` tüm SPA route'larını `index.html`e rewrite eder; `/rooms/...`, `/history` ve browser refresh 404 vermez. Bu, Vercel'in Vite SPA için önerdiği ayardır: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).
5. Vercel'in verdiği kesin production URL'yi kopyalayın: `https://YOUR-ACTUAL-PROJECT.vercel.app`.

`VITE_API_URL` build-time public bir değerdir. Railway URL'si değişirse Vercel değişkenini güncelleyip yeniden deploy etmek zorundasınız. Ayrı WebSocket değişkeni yoktur: frontend Socket.IO `/me` ve `/rooms` namespace'lerini bu HTTPS backend origin'inden açar ve tarayıcı bağlantıyı WSS'e yükseltir. LiveKit URL frontend build'ine gömülmez; her oda için backend `voice-token` cevabından runtime'da gelir.

## 4. İki tarafı birbirine bağlayın

1. Railway backend service içinde `CORS_ORIGIN` değerini Vercel'in kesin production origin'i yapın; path veya son slash eklemeyin:

   ```dotenv
   CORS_ORIGIN=https://YOUR-ACTUAL-PROJECT.vercel.app
   ```

2. Backend'i redeploy edin.
3. Vercel'de `VITE_API_URL` kesin Railway HTTPS domain'ini içeriyor mu kontrol edin; değiştiyse frontend'i redeploy edin.
4. CORS'u kontrol edin:

   ```bash
   curl --include \
     --header 'Origin: https://YOUR-ACTUAL-PROJECT.vercel.app' \
     https://YOUR-BACKEND.up.railway.app/api/healthz
   ```

   Cevap `200` olmalı ve `access-control-allow-origin` tam olarak frontend origin'ini göstermelidir.
5. Frontend'de login olun. Browser DevTools → Network → WS altında backend `/socket.io/` bağlantısının `101 Switching Protocols` olduğunu kontrol edin. `/me` matchmaking, `/rooms` oda durumunu taşır; ikisi de aynı tek Railway instance'ına gider.

Vercel preview domain'leri dinamik olduğu için otomatik wildcard CORS verilmez. Bir preview'ı backend'e bağlamak istiyorsanız o sabit preview origin'ini geçici olarak `CORS_ORIGIN` listesine açıkça ekleyin.

## 5. Production smoke test

Bu testi dört ayrı browser profili/incognito session ile yapın; kopyalanmış tab aynı `sessionStorage` kimliğini taşıyabilir.

1. Dört yeni kullanıcı kaydedin ve uyumlu English level seçin (örneğin ikisi A2, ikisi B1).
2. Dört session'da **Find a partner** seçin. Hepsi aynı dört kişilik odaya yönlenmeli.
3. Oda sayfasında Socket.IO durumu connected, Live Audio durumu connected olmalı.
4. Round 1'de yalnız speaking pair için browser mikrofon izni istemeli. İzin verin ve karşı tarafta sesin duyulduğunu doğrulayın.
5. Listener olan iki session mikrofon izni istememeli ve audio publish edememeli.
6. Round break'te mevcut mikrofon publish'i kapanmalı.
7. Round 2'de roller değişmeli; önceki listener pair için mikrofon izni/publish açılmalı, önceki speaker pair listener olmalı.
8. İkinci round bitince session finished olmalı ve dört kullanıcıda History sayfasında iki topic ile görünmeli.
9. Sayfayı `/rooms/<id>` veya `/history` gibi derin bir route'ta yenileyin; Vercel 404 vermemeli.
10. Admin hesabıyla `/admin` sayfasını açın; normal kullanıcı aynı backend admin endpoint'lerinde 403 almalı.

Mikrofon/WebRTC için frontend, backend ve LiveKit bağlantılarının tamamı HTTPS/WSS secure context içinde olmalıdır.

## 6. Özel domain — isteğe bağlı

Önerilen ayrım:

- Frontend: `app.example.com` → Vercel
- Backend: `api.example.com` → Railway

1. Vercel Project → Settings → Domains altında frontend domain'ini ekleyin ve Vercel'in gösterdiği DNS kaydını DNS sağlayıcınıza girin. Vercel DNS doğrulamasından sonra SSL'i otomatik üretir: [Vercel custom domains](https://vercel.com/docs/domains/set-up-custom-domain).
2. Railway backend → Settings → Networking → Custom Domain altında `api.example.com` ekleyin ve Railway'in gösterdiği DNS kaydını kullanın.
3. Railway backend'i şu değerle redeploy edin:

   ```dotenv
   CORS_ORIGIN=https://app.example.com
   ```

4. Vercel frontend'i şu değerle redeploy edin:

   ```dotenv
   VITE_API_URL=https://api.example.com/api
   ```

5. `/healthz`, CORS, login, WS `101` ve mic testlerini tekrar edin. Eski domain de aktif kalacaksa onu `CORS_ORIGIN` virgüllü listesine açıkça ekleyin.

## 7. Troubleshooting

| Belirti | Düzeltme |
| --- | --- |
| Browser `CORS blocked` gösteriyor | Railway `CORS_ORIGIN` içinde frontend'in tam `https://host` origin'ini, path/son slash olmadan yazın ve backend'i redeploy edin. |
| REST çalışıyor ama Socket.IO reconnect ediyor | Backend domain'inin HTTPS public domain olduğunu, proxy'nin WebSocket upgrade desteklediğini ve Network → WS isteğinin `101` aldığını doğrulayın. |
| `/me` veya `/rooms` bağlanmıyor | Access token'ın güncel olduğunu ve iki namespace'in de `VITE_API_URL` origin'ine gittiğini kontrol edin; API'yi birden fazla replica'ya çıkarmayın. |
| Browser mikrofon izni istemiyor | Kullanıcının o round'da speaker olduğunu, sayfanın HTTPS olduğunu ve site microphone permission'ının browser ayarlarında Block olmadığını kontrol edin. Listener için izin istenmemesi doğrudur. |
| Live Audio `Disconnected` / token mismatch | `LIVEKIT_URL`, key ve secret'ın aynı Cloud projesinden geldiğini; URL'nin `wss://` olduğunu ve local `ws://localhost` değeri kalmadığını kontrol edin. |
| `could not establish pc connection` | LiveKit Cloud URL/token eşleşmesini, firewall/VPN WebRTC erişimini ve LiveKit dashboard quota durumunu kontrol edin. |
| API health check fail | Railway loglarında database bağlantısını kontrol edin; backend `DATABASE_URL` değerini `${{Postgres.DATABASE_URL}}` reference variable yapın. |
| `table does not exist` / migration hatası | Deploy loglarında pre-deploy `npm run db:migrate` adımını inceleyin; migration fail ederse deploy'u canlıya almayın. |
| Topic bulunamıyor | Geçici seed değişkenleriyle container içinde `npm run db:seed:production` komutunu bir kez çalıştırın. |
| İlk istek yavaş/502, timer kayboluyor | Railway Serverless/App Sleeping'i kapatın; backend her zaman açık kalmalıdır. |
| Oda state'i tutarsız veya timer iki kez ilerliyor | Railway backend Replicas değerini tam olarak `1` yapın; bu sürüm yatay ölçeklenmez. |
| Vercel derin route 404 | Root Directory'nin `frontend` olduğunu ve `frontend/vercel.json` dosyasının deploy'a dahil edildiğini doğrulayın. |
| Env değişti ama frontend eski backend'e gidiyor | `VITE_API_URL` build-time'dır; Vercel'de yeni production deployment oluşturun. |

## 8. Maliyet notu

- **LiveKit Cloud Build:** demo/erken kullanım için ücretsiz allowance; güncel dokümanda aylık 5.000 WebRTC participant-minute yer alır. Kota aşılınca Build planında yeni istekler durur.
- **Vercel:** kişisel/non-commercial demo için ücretsiz Hobby plan kullanılabilir. Ticari kullanım ve limitler için deploy etmeden önce [güncel Vercel planlarını](https://vercel.com/pricing) kontrol edin.
- **Railway:** API ve PostgreSQL kaynak tüketimi ücretlidir. Güncel dokümana göre Hobby taban ücreti aylık 5 USD'dir ve ilk 5 USD kaynak kullanımını kapsar; gerçek maliyet CPU, RAM, storage ve egress'e bağlıdır: [Railway pricing](https://docs.railway.com/pricing).
- **Önemli:** maliyeti azaltmak için backend'e Serverless/sleep açmayın. Bu uygulamanın in-memory matchmaking/timer mimarisini bozar. Tek, küçük ama sürekli açık instance kullanın; Railway usage alert/limitlerini dikkatle ayarlayın.
- Custom domain kayıt ücreti ve olası plan değişiklikleri ayrıca değerlendirilmelidir. Fiyat ve kotalar değişebilir; launch günü resmi sayfaları yeniden kontrol edin.

## 9. VPS/self-managed alternatif

`docker-compose.prod.yml` yalnız API + PostgreSQL içerir; production'da LiveKit Cloud dış servistir.

```bash
cp .env.production.example .env.production
```

`.env.production` içindeki tüm placeholder'ları değiştirin. `DATABASE_URL` Docker içindeki `postgres` host'unu kullanmalı, `CORS_ORIGIN` gerçek HTTPS frontend olmalı ve LiveKit değerleri Cloud projesinden gelmelidir. Sonra:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

API varsayılan olarak `127.0.0.1:3000` üzerinde yayınlanır. İnternete doğrudan HTTP açmayın; Caddy/Nginx gibi bir reverse proxy ile `api.example.com` için TLS ve WebSocket upgrade sağlayın. Örnek Caddy route'u:

```caddyfile
api.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

İlk seed:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec api npm run db:seed:production
```

Seed sonrası admin seed değerlerini `.env.production` dosyasından kaldırıp API container'ını yeniden oluşturun. `api` servisini hiçbir zaman birden fazla replica ile çalıştırmayın. Database volume için ayrıca düzenli şifreli backup planı kurun.
