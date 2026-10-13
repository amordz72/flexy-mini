# Flexy Mini — خريطة سلوك النظام ومصادر الحقيقة

**الحالة:** CURRENT WORKING MAP / فحص عبر المستودعات والكود وقراءة قاعدة البيانات فقط  
**التاريخ:** 2026-10-13  
**المالك التنفيذي لواجهة هذا المنتج:** `amordz72/flexy-mini`  
**المرجع المركزي بين المشاريع:** `amordz72/developer`  
**سياسة مجال Flexy الأحدث:** `amordz72/mytool-dev/flexy/policy/CURRENT-POLICY.md` مع `SOURCES.md`  
**هذا الملف وثيقة فهم وسلوك، وليس إذنًا بإرسال USSD أو شحن أو تعديل الأرصدة.**

> **اقرأ هذا الملف قبل أي تعديل Flexy**، ثم افحص الملف البرمجي الحقيقي في المستودع المعني والحالة الحية إذا لزم الأمر. لا تبدأ من الصفر. لا تستنتج أن خاصية جاهزة للإنتاج لمجرد وجود وظيفة SQL أو React أو سجل نجاح قديم.

## 20. 2026-10-13 — SIM Type selector: simple UI first; extra mismatch protection deferred

- **[USER-APPROVED]** Use the existing Stations/SIMs table to choose the managed SIM type directly. Minimal effective options: Mobilis SAMA and Arsselli; one standard Djezzy Flexy type; one standard Ooredoo Flexy type. Gross variants remain in the canonical registry but are not offered in this simple first selector; no schema/catalog duplication.
- **[USER-APPROVED / DEFER]** Owner explicitly postponed new server operator/type mismatch protection. Existing admin authorization and `station_connect_admin_update_sim` validation remain untouched. Do not claim deferred protections implemented or silently add new database constraints. Revisit before expansion to new operators, customer self-service or financial route automation.
- **[UI IMPLEMENTED IN REVIEW BRANCH]** `src/StationOverview.tsx` reuses Ant Design `Select` and `Button` directly within the current desktop Table/mobile Descriptions. The enabled type list is read from `station_connect_admin_sim_types()`, filtered by detected operator, excluding only `-gros` variants for Djezzy/Ooredoo. Save is explicit via existing `station_connect_admin_update_sim`, passing only SIM ID and type. Existing independent Sama PIN setup is preserved; type-selection itself does not change PIN, approve SIM, dispatch USSD or create financial work.
- **[USER-REPORTED]** The previously unknown second Mobilis SIM on new station is Arsselli. This fact is not a user instruction to mutate its record automatically; the admin will choose/save from the new interface once published.
- **[PENDING]** PR CI, published GitHub Pages version and physical browser/PWA test. No live database rows changed through this implementation.

## 18. 2026-10-13 — واجهة Sama القابلة للفتح وإلغاء فرض مبلغ 500

- **[USER-APPROVED]** Sama تُعرض داخل صندوق قابل للفتح فقط، وفيه Mix/Talk/Net؛ PixX وRevolution في صفوف كاملة الاسم والسعر مثل MyTool؛ لا تكرر بطاقات الفئات أو حاويات الشرح. كود الواجهة: `2734383`.
- **[USER-APPROVED]** لا نفرض Arsselli على العروض الأقل من 500، ويمكن تنفيذها بـSama عندما مسار العرض المعين Verified/Enabled والشريحة والرصيد والخادم جاهزون. لا نُخفي أي عرض فعّال تسمح سياسة دور المستخدم بعرضه فقط لأن Sama غير موجودة. كود إزالة فلتر الواجهة: `2734383`.
- **[USER-APPROVED / COMMERCIAL]** عند غياب Sama قبل الـdispatch نعرض نفس العرض، ونجرب فقط Route Arsselli موثوقًا لنفس العرض، ونقدم للزبون خصمًا أقل وفق تكلفة المصدر/هامش الربح مع **عرض الخصم النهائي قبل التأكيد**. لا تثبيت 3% أو أي نسبة مفترضة ولا تغيير خصم بعد الموافقة. التنفيذ البديل والـquote غير جاهزين.
- **[SOURCE]** تغييرات UI: `src/FlexyServicePage.tsx`; اختبارات جديدة `tests/flexy-recipient.test.mjs`; Migration مصدر `supabase/migrations/20261013165000_flexy_mini_verified_sub500_offers.sql`.
- **[DB-READ-ONLY]** RPC `flexy_mini_admin_create_verified_offer_execute` في الإنتاج لا تزال تحوي `c.amount>=500`. **Migration لم تُطبَّق**؛ رفضت أداة التطبيق الاستدعاء. 18 Sama routes verified/enabled و7 Arsselli offer routes draft/disabled. لا تتجاوز الحارس المالي وتدعي نجاح المسار.
- **[TEST/DEPLOY]** الاختبارات أُضيفت لكن لم تتأكد نتيجة GitHub Actions بعد؛ لم يُتحقق من التطبيق المثبت على الهاتف؛ لم يُرسل USSD أو شحن؛ لا تغيير ببيانات Master/الأرصدة المشتركة.
- مرجع التفصيل وخطوات القبول: `docs/SAMA-CATALOG-AND-SOURCE-DISCOUNT-2026-10-13.md`. سياسة المجال الأعلى: `mytool-dev/flexy/policy/CURRENT-POLICY.md` (تصحيح 13-أكتوبر).
- **NEXT:** افحص CI/Pages ثم اعرض رقم الإصدار في الهاتف؛ طبّق واختبر migration server الضيقة عندما تتاح أداة آمنة، ثم جهّز quote تجاري موثق وRoute Arsselli لنفس العرض قبل أي شحن بديل.

## 0. كيف نستعمل الخريطة ولا نضيع مرة أخرى؟

- **[USER-APPROVED]** قرار صريح أكدّه صاحب المشروع، وهو المطلوب حتى لو التنفيذ ناقص.
- **[CODE-VERIFIED]** موجود فعلًا في Source أو SQL الذي تمت قراءته؛ لا يعني اختباره على الجهاز.
- **[DB-OBSERVED]** وجدناه في Supabase أثناء الفحص بتاريخ هذا الملف؛ لقطة تتغير، وليست إثبات اتصال دائم.
- **[HISTORICAL-TEST]** تجربة أو سجل قديم، لا ننقله تلقائيًا إلى حكم على النسخة الحالية.
- **[PENDING]** نقص مثبت أو عمل يحتاج اختبارًا، لا نسمّيه نجاحًا.
- **[SUPERSEDED]** قرار سابق استُبدل بالأحدث، يُحفظ للتاريخ ولا يُنفّذ تلقائيًا.

**ترتيب فضّ التعارض:** تأكيد المستخدم الأحدث + الدليل الحي الأحدث → سياسة `mytool-dev/flexy/policy/CURRENT-POLICY.md` المنطبقة على المجال → كود/Schema الإنتاج بعد التحقق → وثائق Developer المتخصصة → التجارب والمشاريع القديمة. لا يُعامل قرار Tehna 2026-08-23 على أنه يلغي تحديثات 2026-09-21/28.

## 1. لماذا نبني Flexy Mini؟

الهدف [USER-APPROVED]: منصة فليكسي عملية تقلل الاعتماد على تطبيقات خارجية منخفضة الهامش. المطلوب **بيع/تنفيذ فليكسي فعلي** لا مجرد صفحة جميلة أو مختبر اكتشاف.

- **الشاشة المشتركة نفسها** لمدير المحل والعامل/الزبون، مع إمكانات وصلاحيات مختلفة؛ ممنوع إنشاء واجهتين متنافستين للأدوار.
- شاشة «فليكسي»: رقم المستفيد → «عروض / رصيد عادي» → معرفة المجموعة المتاحة → اختيار العرض/المبلغ → توضيح المصدر والرسوم → تأكيد → متابعة الحالة والنتيجة. العميل لا يشاهد أدوات إدارة المحطة.
- شاشة «المحطات والشرائح»: الاعتماد، الهوية، المودم، SIM، PIN المحفوظ، الجاهزية، التشخيص والرصيد؛ **لا تتحول إلى صفحة بيع أو صفحة استكشاف عروض منفصلة**.
- اكتشاف عروض رقم الزبون عملية مساعدة **داخل مسار الفليكسي**؛ التاريخ الإداري قابل للطي، ولا يرسل استعلام عند فتح الصفحة.
- **الـAgent لا يحدد الأسعار أو الربح أو مجموعة العروض أو اختيار مصدر التنفيذ.**

## 2. المستودعات — من يملك ماذا؟

| المستودع | مصدر الحقيقة/المسؤولية | ممنوع الخلط |
|---|---|---|
| `amordz72/flexy-mini` | Refine + React + Vite + Ant Design + PWA، شاشة البيع الحالية، استدعاء RPC، تجربة الإدارة والزبون | لا يملك دفتر الأرصدة أو كود المودم أو SIM مستقلة عن المصدر المركزي |
| `amordz72/mytool-dev` | سياسة Flexy الحالية، كتالوج/مصادر/Routes/Profiles وسياسات الرصيد ومigrations مشتركة | لا نكرر جداول Master أو المال في Flexy Mini |
| `amordz72/station-connect` | Agent Windows Node، هوية المحطة، heartbeat، مودمات، jobs/sessions/commands، Gateway، إرجاع رد الشبكة | لا يُوضع تسعير أو تحليل تجاري متين داخل Agent |
| `amordz72/station-services` | خدمات عامة قابلة لإعادة الاستخدام: Huawei HiLink، Remote NDIS، USB، IP watcher، SMS، diagnostics | ليس سيرفر أعمال الفليكسي؛ hilink-modem 0.2.0 لم يُثبت نهائيًا على Windows الحقيقي |
| `amordz72/developer` | الوثائق والسياسات السابقة ودروس الأخطاء وخطوة العمل التالية | ليس المستودع التنفيذي ولا مخزن أسرار |
| `amordz72/tehna-connect-core` و`tehnapay-connect` | مراجع بحث وتجارب Discovery / Laravel / عروض وقدرات سابقة | **REFERENCE ONLY**؛ لا نعتمد قرارات قديمة خالفت سياسة MyTool الحالية أو ننقل التنفيذ آليًا |

**المصدر المركزي الحالي للبيانات:** مشروع Supabase مشترك، لا قاعدة موازية جديدة داخل Flexy Mini. `Station Connect` ينفذ من خلال Server Adapter/DB، ولا يتطلب وجود Laravel لإكمال المنتج الحالي.

## 3. الطبقات الثابتة التي لا تُخلط

`Operator → Offer identity → Knowledge/Discovery → Presentation group → Execution route → Execution profile → Routing policy → Physical SIM / distributor account → Readiness → Execution decision → Job/Session/Command → Result → Operational balance → Reconciliation/Alert/Recharge`

| المفهوم | معناه |
|---|---|
| المشغل | Mobilis / Djezzy / Ooredoo |
| هوية العرض | **operator + family + amount**؛ لا يدخل فيها رقم Index أو نوع الشريحة أو المودم |
| Family | PixX، Revolution، Sama Mix، Sama Talk، Sama Net... |
| Presentation Group | PIXX / REVOLUTION / SAMA؛ مجموعات ظهور حسب ما أثبته استكشاف المستفيد |
| Catalog | بيانات العرض المعروفة والمبالغ والمسارات؛ لا يعاد بناؤها عند كل عملية |
| Source / Route | كيف يمكن تنفيذ عرض معلوم؛ قد توجد بدائل Sama/Arsselli لاحقًا |
| Profile | خطوات وقالب USSD وقواعد الأدلة؛ Schema/قراءة إدارة موجودة تاريخيًا، والمحرك الحي المبني على Profiles **غير مثبت كمسار كامل** |
| Physical SIM | ICCID/IMSI ونوع الشريحة وحالتها ومحطتها ورصيدها؛ ليست هوية العرض |
| Station/Modem | منفذ Hardware متغير؛ IP/USB ليس هوية دائمة للشريحة |
| Balance | رصيد تشغيلي لكل SIM أو حساب موزع، لا مجموع عام دون مصدر |
| Card stock | مخزون تجهيز/تعبئة الشرائح، منفصل عن عروض البيع للعملاء |

**[SUPERSEDED]** هوية `SimType + Family + Amount` القديمة و«Sama المصدر الوحيد ولا fallback» القديم.  
**[CURRENT]** إمكانية مصادر متعددة وترتيب ديناميكي عندما تكون Routes معتمدة؛ **[CURRENT PHYSICAL PILOT]** التركيز في الاختبارات الحالية على Mobilis Sama فقط، دون الادعاء أن كل المصادر متصلة.

## 4. الرحلة الصحيحة من أول تشغيل حتى إتمام عرض

### F0 — هوية وصلاحيات
1. المستخدم يدخل بواسطة النظام الحالي؛ جهاز الزبون الموثوق يحتاج اعتمادًا حسب صلاحياته.
2. الخادم يميز المدير/العامل/الزبون؛ أفعال المال/إدارة الشرائح لا تكفي فيها إخفاء الأزرار.
3. [CODE-VERIFIED] عمليات استكشاف/تنفيذ الإدارة الحالية RPCs خلف `private.is_shop_admin()`. [PENDING] لا توجد قناة مكتملة مصادق عليها لتمكين الزبون من discovery/send المالي بنفس الطريقة؛ **لا تُفتح RPC إدارية للعميل/anon**.

### F1 — تجهيز المحطة والشريحة تلقائيًا حيثما أمكن
1. Station Agent يفتح اتصالًا **Outbound HTTPS**، enroll/approved، heartbeat، اكتشاف المودمات/الشرائح.
2. نربط SIM بهوية مستقرة **ICCID/IMSI**؛ رقم هاتف الشريحة يُقرأ إن تيسر أو يؤكد إداريًا، وليس رقم العميل المستفيد.
3. تتحقق المنصة من SIM type الحقيقي: `mobilis-sama` أو `mobilis-arsselli`... وليس من ظهور مودم قديم فقط.
4. خدمة PIN الخاصة بالشريحة تُخزن في Secret/Vault؛ لا توضع في كود الواجهة أو الوثائق أو logs.
5. **الاعتماد الأمني للشريحة إجراء إدارة صريح عند التجهيز الأول**؛ لا تخلطه مع قراءة الرصيد اليومية.
6. تُعرض أسباب عدم الجاهزية بدقة: station heartbeat، modem، SIM، operator، sim_type، PIN، approval، baseline/balance، route.
7. [CODE-VERIFIED] `src/StationOverview.tsx` يجهز Sama، `src/SamaOperationalActions.tsx` يعرض الجاهزية والإذن/الفحص اليدوي؛ ``flexy_mini_admin_sama_readiness()` في DB تقرأ الحالة.
8. [PENDING] جعل **القراءة الأولى للرصيد آلية بعد اعتماد الشريحة** بدل شرط أن يضغط المستخدم على زر قراءة يدوي؛ الزر القديم يبقى fallback وتشخيص.

### F2 — المستفيد واكتشاف مجموعته
1. تطبيع رقم الزبون: إزالة الفراغات والفواصل، +213/213 تتحول إلى 0، الاتجاه LTR؛ تحقق رقم جزائري 10 أرقام.
2. افحص آخر Discovery **موثوق وصالح لنفس رقم المستفيد**؛ TTL ديناميكي. لا تستخدم نتيجة مستفيد آخر.
3. إذا كان صالحًا، استعمل Group من `station_connect_offer_discoveries` دون إرسال USSD.
4. **[USER-APPROVED / CODE 2026-10-13]** الضغط على «عروض» إجراء واحد: يقرأ Cache لنفس الرقم أولًا، ثم إن غابت نتيجة موثوقة وصالحة وكانت Sama جاهزة ولا توجد جلسة جارية أو غير مؤكدة، يبدأ **استعلام USSD واحدًا تلقائيًا** عبر Station Connect، بلا زر «استكشاف العروض» ولا «تأكيد الاستعلام» إضافيين. فتح الصفحة أو الكتابة وحدهما لا يبدأ USSD. تأكيد الشحن المالي مستقل وإلزامي.
5. Session USSD [مرجع تجارب Sama]: `*665*1*{phone}#` → طلب PIN الخدمة للشريحة حين تطلبه الشبكة → قراءة القوائم → 0/00 للتنقل فقط → raw responses محفوظة. لا اختيار عرض/تأكيد شحن أثناء الاكتشاف.
6. رد الشبكة يحدد SAMA (Mix/Talk/Net)، PIXX أو REVOLUTION؛ قد يكون الحقل العلوي `family` فارغًا لكن عناصر القائمة تكفي لتحديد مجموعة واحدة. الرد المتناقض = UNKNOWN.
7. الحالات: CLASSIFIED / IN_PROGRESS / NEEDS_DISCOVERY / UNKNOWN / NETWORK_ERROR؛ **خطأ أو فراغ لا يعني عدم وجود عروض**.
8. [CODE-VERIFIED] `src/CustomerOfferIdentity.tsx` + RPC `flexy_mini_admin_customer_offer_identity` و`station_connect_admin_create_offer_discovery`؛ المدة الافتراضية الحالية **168 ساعة/7 أيام قابلة للتعديل**. لا نعيد اكتشاف كتالوج العرض الكامل لكل عملية.

### F3 — عرض الكتالوج وتحديد الخدمة
1. اقرأ `flexy_offer_catalog` عبر `flexy_get_visible_offer_catalog_v2` وفق role policy.
2. بعد تحقق مجموعة المستفيد، اعرض عروض المجموعة وحدها؛ لا تجمع PixX وRevolution وSama قبل التصنيف.
3. الظهور **لا يساوي الجاهزية للتنفيذ**؛ إن غابت SIM لا نحذف العرض من Catalog، بل نوضح حالة التنفيذ.
4. Network Index والـExecution Profile مملوكان للمسار المعتمد؛ الإدخال اليدوي يطابق Catalog موثوقًا، لا يسمح بكود USSD مفتوح.
5. سياسة الكتالوج تشمل قوائم 50/100... تاريخيًا، لكن Flexy Mini الحالي يخفي ما دون **500 دج** [CODE-VERIFIED]؛ هذا **فلتر واجهة/مرحلة** وليس دليلًا أن الشبكة لا تعرض 50/100. قرارات الإظهار حسب الدور ومستوى الأمان مستقلة.
6. «رصيد عادي» مستقل عن «عروض»؛ لا تُرسل Sama كرصيد Arsselli بالخطأ. الشاشة الحالية تعرض خيار الرصيد لكن التنفيذ معطل حتى Route مثبت.

### F4 — التحضير والإرسال المالي الآمن
1. تأكد: رقم مستفيد صحيح + Discovery ما زال موثوقًا + عرض من مجموعته + Route مسموح + Source واقعي + رصيد تشغيلي كافٍ.
2. السياسة الأحدث يمكنها ترتيب عدة Routes حسب enabled/verified/priority والرصيد؛ **مسار Flexy Mini الحالي موجّه عمليًا إلى Sama** ولم يثبت تطبيق Router متعدد المصادر داخل هذه الشاشة.
3. تأكيد المستخدم النهائي وحده يرسل Job مالي. لا USSD تلقائي بمجرد اختيار العرض.
4. [CODE-VERIFIED] `src/FlexyServicePage.tsx` يرسل `flexy_mini_admin_create_verified_offer_execute` الذي يربط رقم الزبون بنتيجة Discovery المعتمدة والعرض داخل الخادم، ثم يفوّض `station_connect_admin_create_offer_execute_v2`.
5. رقم Idempotency خاص بنيّة الطلب نفسها ويظل محفوظًا عبر تحديث PWA؛ لا يعاد إرسال عملية معلقة بمفتاح جديد، ونتيجة UNKNOWN/REVIEW ليست نجاحًا/فشلًا محسومًا.
6. الخادم يجهز Job → Session → Commands (`ussd_start`/`ussd_reply`/`ussd_release`) وينتظر رد الشبكة؛ Agent يرجع raw response ولا يصنف نجاحًا ماليًا من مجرد ACK.
7. النجاح = رد أو دليل مؤكد، الفشل = رد مؤكد، الغموض = REVIEW وتحقيق لا إعادة مالية آلية.
8. [PENDING] تدقيق ربط `station_connect_begin_command_session` بهوية SIM/جلسة حديثة عبر تبديل المودمات، واختبار end-to-end على النسخة الحالية قبل توسيع الشحن.

### F4a — سياسة اختيار مصدر عروض Mobilis (قرار 2026-10-13)

**[USER-APPROVED / الأكثر حداثة]:** القرار البسيط عند إرسال عرض مُفعّل هو **Sama أولًا، وإذا لا توجد Sama متاحة مؤهلة لهذا العرض → Arsselli تلقائيًا**، بدون جعل الزبون يختار الشريحة. اختيار المصدر يتم في **Server Router قبل إرسال USSD مالي**، وليس بعد فشل طلب بدأت الشبكة تنفيذه.

- «Sama غير موجودة» تشمل غياب/عدم اتصال الشريحة، عدم موافقة الإدارة، غياب PIN أو رصيد تشغيلي كافٍ، أو Route غير verified/enabled. لا يعتبر ضعف إشارة الشبكة وحده فشلًا مسبقًا؛ نحاول عملية واحدة عندما شروط الأمان والمصدر مستوفاة.
- فحص البديل يتطلب Route Arsselli منفصلًا **لنفس العرض** verified+enabled وشريحة فعلية معتمدة ورصيد حساب موزع كافٍ. **لا تغيّر خدمة PixX/Revolution/Mix إلى شحن رصيد عادي صامت.**
- إذا لا يوجد مصدر صالح **قبل dispatch**: لا يوجد Job مالي، ونظهر **«الخدمة غير متاحة حاليًا، يرجى المحاولة بعد حين»**.
- إذا حصل خطأ شبكة **مؤكد أنه لم يُنفذ ماليًا**: **«يرجى المحاولة بعد حين»**. أما Timeout/رد غامض بعد بدء الإرسال فيصبح REVIEW **«طلبك قيد التحقق، لا تعاود الإرسال الآن»**، بلا Retry أو تغيير SIM تلقائي؛ منع ازدواج الشحن أساسي حتى عند ضعف الشبكة.
- حفظ قرار Route والـJob/Idempotency ومصدر الرصيد لكل طلب. Sama: مبلغ العرض + 10 دج عند النجاح المؤكد. Arsselli: المبلغ من حساب الموزع المختار. لا تستخدم Index Sama مع Arsselli.
- التبديل لا يغيّر مجموعات العروض المرئية للعميل؛ Presentation/Discovery مستقلة عن Routing.

**[CODE-VERIFIED 2026-10-13]**: `public.station_connect_admin_offer_route_preview` في Supabase يرتب المسارات الموثوقة والمفعلة حسب `priority` والرصيد؛ سياسة Core تسمح fallback. لكن `FlexyServicePage.tsx` ما زال يعمل بإرسال Sama-only إلى `flexy_mini_admin_create_verified_offer_execute`. مسارات Arsselli للعروض في الإنتاج `draft/disabled` (مثل PixX)، وخدمة `station_connect_admin_create_arsselli_flexy_696_v2` هي تنفيذ رصيد عادي بالمبلغ، لا تحويل عروض مثبت. **القرار مُسجَّل، والتنفيذ التلقائي المالي إلى Arsselli لم يُفعّل ولم يُختبر**؛ لا نتجاوز اعتماد Route أو نغيّر جدول الإنتاج لمجرد الوثيقة. السياسة المرجعية: `mytool-dev/flexy/policy/CURRENT-POLICY.md` (قسم Routing Policy المحدث).

### F5 — متابعة النتيجة والعمل اليومي
1. تظهر الحالة queued/claimed/success/failed/review، Job ID، وقت الطلب، النتيجة، والمصدر.
2. لا تكرار مالي عند انقطاع شبكة المستخدم أو إعادة تشغيل PWA.
3. تُسجل عملية العميل/الحساب/الـSIM المسؤولة في طبقة الأعمال/الدفتر المناسبة؛ واجهة Flexy Mini ليست Ledger جديدًا.
4. [PENDING] تمكين زبائن Flexy Mini من الإرسال مع تحقق المحفظة والحدود والحجز والصلاحيات من الخادم، واختبار آخر حالة وواجهة الجوال بعد النشر.

## 5. الرصيد التلقائي — قرار ملزم لا زر يدوي كل مرة

**[USER-APPROVED، مُعاد تأكيده 2026-10-13]** هذه السياسة كانت موثقة منذ 2026-09-22. مصدرها الأصلي:
- `amordz72/developer/projects/flexy/BALANCE-DISCOVERY-CUMULATIVE-RECONCILIATION-POLICY-2026-09-22.md`
- `amordz72/developer/guidelines/operational-balance-inventory-and-reconciliation.md`
- `amordz72/mytool-dev/supabase/migrations/20260922211500_flexy_cumulative_balance_router_v1.sql`

### دورة الرصيد لكل SIM/Account
`SIM online & approved → إذا لا يوجد Baseline، اطلب أول Balance Lookup من الخلفية مرة واحدة → احفظ الرصيد الحقيقي → احسب Expected من العمليات المؤكدة → فحص Router/Low threshold → Reconciliation وفق سبب فعلي → سجل الفرق + Snapshot جديد`

المعادلة:
`expected = last_successful_network_baseline + confirmed_inflows_since_baseline − confirmed_outflows_since_baseline`

- **SAMA:** خصم نجاح عرض = مبلغ العرض **+ 10 دج** ثابتة. نجاح 500 → خصم تشغيلي 510.
- **Arsselli:** خصم نجاح = المبلغ نفسه من **حساب الموزع المحدد**؛ 04/GTS و05/Mobilis أمثلة، ليست Offer Index.
- **Failed:** لا خصم. **Unknown/Review/Assumed:** لا خصم نهائي ولا إعادة مالية آلية؛ يمكن Reservation منفصل إذا تأكدت سياسة المحفظة.
- **لا TTL زمني يمنع التنفيذ** عندما يوجد Baseline ناجح وحساب تراكمي موثوق؛ انتهاء 6/12 ساعة لا يفرض قراءة قبل كل بيع.
- **المطابقة:** Trigger بالاستهلاك المؤكد منذ آخر Baseline (بداية **20,000 دج** قابلة للتعديل)، أو عودة شبكة/تعبئة خارجية/نتيجة غامضة/اختلاف فعلي؛ المقارنة `actual - expected` تُحفظ للمراجعة ولا تمحو التاريخ.
- **حد الرصيد المنخفض:** مستقل وقابل للضبط **لكل شريحة أو حساب مصدر**؛ إنذار الإدارة عند عبور الحد، مع منع سيل إشعارات مكررة. نفاد بطاقة التجهيز ليس مانعًا لكل Route مستقل.
- **فشل قراءة الرصيد:** لا تخمن صفرًا ولا تكرر USSD في حلقة. أول Baseline شرط مصدر جديد؛ بعده المطابقة المستحقة لا توقف شحنًا لمجرد مرور الوقت.
- **بطاقات تعبئة الشريحة:** تتبع مخزون بطاقات Mobilis 1000/2000 في نظام مستقل؛ لا تستعمل البطاقة أو تعاودها وهي REVIEW. لا تفعّل تعبئة ذاتية من دون سياسة معتمدة منفصلة.

**الحالة الحقيقية للميزات**:
- [CODE-VERIFIED] النواة التراكمية **موجودة** في MyTool Dev + Supabase (دالة `private.station_connect_operational_balance` وواجهة قراءة الإدارة). تخصم العمليات المؤكدة من Baseline وتحسب reconciliation_due. لا يلزم تحديث رصيد رقمي يدوي عند كل نجاح.
- [CODE-VERIFIED] زر `station_connect_admin_queue_balance`، وAgent `agent/src/balance.js` موجودان للقراءة الحقيقية؛ إعداد Sama حاليًا يحتوي زرًا يدويًا للاختبار/التشخيص.
- **[PENDING]** trigger/worker تلقائي موثق لأول Baseline بعد تجهيز SIM، وجدولة آمنة single-flight/backoff لمطابقة الرصيد، وتنبيهات Low/Empty التي تصل للإدارة — **لم يثبت أنها تعمل end-to-end في Flexy Mini الحالي**. لا نكتب نظام أرصدة جديدًا بدل إصلاح ربط الموجود.

## 6. كشف رقم الشريحة ≠ كشف عروض المستفيد

- **رقم الشريحة الموصولة:** خاصية SIM (ICCID/IMSI)، يمكن قراءتها من HiLink ثم وسيلة موثقة **مربوطة بنوع SIM الدقيق**. لا تعتمد على المتعامل وحده. Mobilis `*101#`، Djezzy `99` عبر Service Code مع Agent داعم؛ المسار النهائي يتحدد من سجل القدرات الدقيق.
- **اكتشاف عروض الزبون:** يستعلم عن *رقم الزبون المستفيد* عبر Sama ويستنتج Family/Group، لا يغيّر رقم SIM أو PIN أو مصدرها.
- Ooredoo `*200*PIN#` **غير مثبت كاستعلام آمن**؛ لا تجرّبه تلقائيًا ولا تستعمل PIN أو كود بطاقة تخمينًا. توجد حراسة DB تمنع تكرار استعلام رقم أوريدو بعد الخطأ حتى 24 ساعة + موافقة إدارة جديدة.
- لا تسجّل PIN، كلمة مرور، رقم بطاقة شحن، أو الرد الخام السري في Git أو Developer.

## 7. الدليل التاريخي ≠ اختبار منتج اليوم

**[DB-OBSERVED، 2026-10-13، أرقام تجميعية فقط بلا أرقام زبائن]:**
- `station_connect_jobs`: **17** `mobilis.offer.discovery` بحالة success، أحدثها 2026-09-28.
- `station_connect_offer_discoveries`: **28** سجل `DISCOVERY_COMPLETE` ناجح؛ أحدثها 2026-09-28. لم تعد ضمن TTL سبعة أيام بتاريخ الفحص، ولا ينبغي تقديمها كتصنيف صالح اليوم.
- `station_connect_jobs`: **4** `mobilis.offer.execute` success و**1** review مسجلة قديمًا؛ و**6** نجاحات لمسار `mobilis.flexy.arsselli.696` مع 3 إخفاقات تاريخية. هذه أدلة على مسارات سابقة لا على نجاح الشحن من **Flexy Mini الحالي**.
- قاعدة البيانات تحتوي SIM records متعددة؛ **وجودها لا يساوي وجود شرائح موصولة فعليًا**. يُفحص Heartbeat لكل محطة/مودم/شريحة عند القرار.
- [USER-PWA-OBSERVED] وصل `Flexy Mini` للهاتف بكود بناء مرئي `4c97c9c` عند عرض المحطات؛ تغييرات التأكيد اللاحقة كانت Source commits **وليست إثبات PWA عند الجهاز**. يجب الاعتماد على زر «نسخ النسخة» بدل توقع أن آخر Commit وصل.
- [USER-OBSERVED] النقر سابقًا على أزرار اعتماد Sama/الرصيد لم يُظهر Static Modal في PWA؛ لذلك نُقلت النافذة إلى تأكيد Inline في `src/SamaOperationalActions.tsx`. **ظهور التأكيد الجديد على الهاتف لم يُثبت بعد**.

## 8. حالات الأعمال (لا تختزل كل الحالات في نعم/لا)

| المكوّن | حالة صحيحة | الخطأ الذي نتجنبه |
|---|---|---|
| Station | pending / approved / suspended / revoked + heartbeat freshness | «متصل» اعتمادًا على آخر سجل قديم |
| SIM | unknown / mobilis-sama / mobilis-arsselli / ... مع ICCID/IMSI ومصدر الرصيد | مزج نوع شريحة واسم مجموعة العرض |
| Discovery | NEEDS_DISCOVERY / IN_PROGRESS / CLASSIFIED / UNKNOWN / NETWORK_ERROR | UNKNOWN = NO OFFERS |
| Catalog | معروف/مستورد/مدخل يدوي + سياسات عرض | وجود العرض = توفر منفذ تنفيذه |
| Route | verified/enabled/priority/candidate/review | if amount>=500 use Sama دون سياسة |
| Financial Job | queued / claimed / success / failed / review | timeout=failed أو ACK=success |
| Balance | UNINITIALIZED / READY / RECONCILIATION_DUE / DISCOVERY_UNAVAILABLE | قديم زمنيًا = صفر/غير صالح |
| Low-stock | normal / low / empty + dedup alert | إجبار كل الشرائح على حد واحد |
| Card Recharge | available/reserved/used/review/failed وفق نظامه | إعادة استخدام بطاقة معلقة/متشكك فيها |

## 9. خريطة الملفات وRPCs — الطريق الأقصر للفحص

### Flexy Mini UI
- `src/main.tsx`: Shell المشتركة، Auth، مسار `flexy` و`stations`، تنقل الإدارة/العميل.
- `src/FlexyServicePage.tsx`: إدخال رقم الزبون، عروض/رصيد، كتالوج حسب الدور، اختيار العرض، تأكيد الإرسال، idempotency محلي، فحص جاهزية Sama.
- `src/CustomerOfferIdentity.tsx`: cached discovery + explicit session request + تحديث الحالة؛ **الاستكشاف الحي للإدارة فقط حاليًا**.
- `src/SamaOfferDiscoveries.tsx`: السجل الإداري التاريخي داخل Flexy بوضع `historyOnly`.
- `src/StationOverview.tsx`: المحطات والمودمات والشرائح ومعلوماتها وتجهيز Sama والحراسة الخاصة بأوريدو.
- `src/SamaOperationalActions.tsx`: حالة الجاهزية، الاعتماد الإداري، وزر رصيد احتياطي بتأكيد Inline؛ **ليس محرك الرصيد التلقائي**.
- `src/BuildCopyButton.tsx`: نسخة الـPWA المثبتة مع مرجع GitHub Actions.

### Supabase (قاعدة مشتركة)
- `public.flexy_offer_catalog`، `flexy_offer_execution_routes`، `flexy_offer_role_policies`: العروض والطرق والعرض حسب الدور.
- `public.station_connect_stations`، `station_connect_modems`، `station_connect_sims`: المورد المادي وحالته وهويته.
- `public.station_connect_jobs`، `station_connect_sessions`، `station_connect_commands`: سجل العمل/الأوامر، له حالة ونتيجة؛ لا ينشأ Ledger ثاني.
- `public.station_connect_offer_discoveries` و`station_connect_offer_observations`: تاريخ اكتشاف أرقام العملاء والردود الموثقة.
- `private.flexy_customer_offer_discovery_settings`: مدة الصلاحية القابلة للضبط.
- `public.flexy_mini_admin_customer_offer_identity`: تصنيف المستفيد من Discovery موثوق.
- `public.station_connect_admin_create_offer_discovery`: جلسة استكشاف عبر Sama.
- `public.flexy_mini_admin_create_verified_offer_execute`: ربط مستفيد/Discovery/عرض قبل التفويض للتنفيذ.
- `public.station_connect_admin_create_offer_execute_v2`: المسار المالي القائم لدى Station Connect.
- `private.station_connect_operational_balance` / `station_connect_admin_sim_operational_balances`: الحساب التراكمي وقراءة الإدارة.
- `public.flexy_mini_admin_sama_readiness`: فحص جاهزية بدون USSD.
- `public.station_connect_admin_set_sim_flexy_approval`، `station_connect_admin_queue_balance`: اعتماد وسؤال الرصيد اليدوي عند الحاجة.

### Station Connect
- `agent/src/index.js`: حلقة Agent/heartbeat/Claim (نسخة مصدر GitHub المفحوصة 0.4.12، **ليست إثبات إصدار المثبت على المحطة**).
- `agent/src/command-executor.js` و`agent/src/workflow.js`: تنفيذ أوامر تقنية USSD.
- `agent/src/balance.js`: قراءة رصيد شبكة Sama.
- `server/supabase/functions/station-gateway/orchestrators.ts`: متابعة ردود الشبكة والجلسات بمنطق السيرفر.
- `contract/station-api-v1.md` و`docs/ARCHITECTURE.md`: العقد/المسؤوليات.
- `amordz72/station-services/services/hilink-modem/`: قدرة HiLink عامة (فحص Windows حقيقي مستقل قبل الاستبدال).
- **الـAgent المثبت ليس بالضرورة آخر Source Commit. لا تحدّثه عشوائيًا بدون صورة SHA/Version ومراجعة البروتوكول.**

## 10. المخالفات/الثغرات التي وجدناها — لا نقفز فوقها

1. **[PENDING]** أول قراءة تلقائية للـSIM واستدعاء المصالحة والتنبيه منخفض الرصيد لم تثبت end-to-end، رغم وجود Core DB تجميعي منذ سبتمبر. المطلوب وصل الناقص، لا اختراع نموذج آخر.
2. **[PENDING]** `SamaOperationalActions` يعرض زر «قراءة الرصيد» يدويًا؛ هذا **fallback / diagnostics** وليس طريقة التشغيل النهائية المعتمدة. يجب تغيير السلوك لاحقًا لا الاكتفاء بالوثيقة.
3. **[PENDING]** مسار `FlexyServicePage` الحالي يرسل عبر Sama فقط؛ السياسة الأحدث تسمح Routes متعددة/Arsselli إذا ثبتت وأُذن بها، فلا تخلط نطاق pilot بسياسة المنتج الأبدية.
4. **[PENDING]** تأمين تنفيذ العملاء بالمحفظة وبـRPC/Backend مخصّص لا يسمح بالاستعلام عن أرقام اعتباطية؛ لا فتح admin RPCs للكل.
5. **[PENDING]** تدقيق ربط Session→SIM والـmodem بعد تبديل USB/IP، idempotency عند فشل الاتصال ومراجعة UNKNOWN قبل أول تجربة مالية من Flexy Mini.
6. **[PENDING]** اختبارات PWA/CI المنشورة للنسخة الجديدة وتأكيد دور الإدارة/العميل/تأكيدات الهاتف.
7. **[KNOWN STALE DOC]** كان `README.md` في Flexy Mini يصف المشروع بأنه Scaffold بلا Station Connect أو تنفيذ مالي، وهذا مخالف للكود الحالي؛ يجب تصحيحه والربط بخريطة السلوك.
8. **[HISTORICAL VS CURRENT]** ملف Developer `projects/flexy/MASTER-REFERENCE.md` يصف `flexy-mini` كـ`EMPTY` في فقرة من 2026-08-31؛ هذا وصف تاريخي **SUPERSEDED** بكود 2026-10-13.
9. **[PENDING]** Execution Profiles Schema موجودة لكن مسار التنفيذ الحي لم يثبت اعتماده كليًا؛ لا نقل Profiles إلى كل عرض ولا فرض ترحيل كبير بلا اختبار.
10. **[PENDING]** سياسة threshold والتنبيهات لكل SIM تحتاج واجهة إعداد واختبار منع تكرار الإشعارات، والرصيد التفصيلي مع فرق المطابقة.

## 11. ترتيب الإنجاز القادم (بدون إعادة اختراع)

1. اقرأ هذه الخريطة و`mytool-dev/flexy/policy/CURRENT-POLICY.md`؛ افحص SQL الإنتاج الحالي والـAgent المثبت، ولا تبدأ SQL جديدًا قبل مراجعة القائم.
2. **الأولوية الحالية:** أكمل Automatic Opening Balance / initial Baseline لشرائح Sama بعد تعريفها واعتمادها، بالاعتماد على Job queue نفسها وبـsingle-flight/fail-safe؛ لا تجعل المدير يضغط «قراءة الرصيد» كل مرة.
3. أثبت من Core ببيانات اختبار معزولة أن شحن Sama 500 يخصم 510 **مرة واحدة**، وFailure/Review لا يخصمان مؤكدًا، ثم مصالحة على الحد مع تسجيل Delta.
4. فعّل Low/Empty alerts لكل SIM/Account في الإدارة مع Threshold قابل للتغيير وdedup؛ سجّل الدليل الميداني، لا تكتفِ بتوثيق.
5. افحص UI الهاتف ووصول كود البناء وتأكيد المستخدم وحراسة Session→SIM.
6. بعد التهيئة الآمنة، تجربة اكتشاف واحدة ثم **شحن فعلي واحد بإذن المستخدم الصريح**، مع مرجع الطلب والناتج/الخصم والمطابقة.
7. توسع لاحقًا إلى Arsselli/Routes إضافية والعملاء فقط بعدما تثبت السياسة والقدرات الفعلية؛ لا تستبدل pilot بوعود غير مختبرة.

## 12. طريقة تحديث هذه الخريطة بعد كل تجربة

لكل Feature أو عطل سجل **في هذا الملف أو وثيقة ملحقة مرتبطة به**:
- **طلب/سلوك المستخدم** + الخطأ الذي كان يحصل؛
- **المكوّن المالك** (Flexy Mini / DB MyTool / Station Connect / Station Services)؛
- **ما رأيناه** (Code/DB/فيديو/نتيجة اختبار) + التاريخ + Commit / Migration / Run ID إن توفر؛
- **ماذا نعرف أنه نجح** مقابل **ما بقي غير مُتحقق**، وهل أُرسل USSD/شحن أم لا؛
- **القرار الحالي** وهل يلغي قرارًا تاريخيًا؛
- **الاختبار التالي المحدد** فقط.

**قاعدة الحفظ:** Developer يشير إلى هذه الخريطة ويحتفظ بالمعرفة العامة؛ التفاصيل التنفيذية والملفات وآخر فحص داخل Flexy Mini. لا تُنسخ هذه الوثيقة كاملة في Developer. لا تُدخل فيها بيانات حساسة أو PIN أو أرقام زبائن أو أرصدة شخصية.


## 13. 2026-10-13 — متابعة UX وربط الاكتشاف من تصحيح البناء

**USER-APPROVED:** رقم مستفيد واحد، رصيد عادي افتراضي، زر عروض لنفس الرقم؛ لا إعادة بناء الرصيد ولا شحن حقيقي أثناء التطوير.

**الدليل قبل التعديل:** Actions `38392986175` للتصحيح `96c78a8473b1b812ecb561dafd896c085e1ba644` نجح في build/deploy، وPages JavaScript احتوى SHA نفسه. هذا دليل الموقع المنشور، وليس PWA Android المثبتة. راجعنا المصدر الحالي لـMyTool `flexy/index.html` وTehna `CustomerFlexy.php` وBlade، ثم RPCs الإنتاج وStation `orchestrators.ts`؛ لا نسخ تصميم أو Backend جديد.

**IMPLEMENTED / LOCAL TESTED:**
- `src/FlexyServicePage.tsx`: البداية رصيد عادي؛ حقل هاتف واحد LTR يطبّع +213/213 والمسافات؛ تغيير هوية الرقم يمسح الاختيار/تصنيفه ويعيد وضع الرصيد، مع الاحتفاظ بالطلب المالي المعلق منفصلًا. اختيار عروض يقرأ Cache أولًا. بطاقة الاستكشاف تبقى مركبة أثناء تبديل الوضع لمنع فقد مرجع جلسة جارية.
- `src/CustomerOfferIdentity.tsx`: عند طلب العروض وغياب Cache صالح يظهر تأكيد داخل الصفحة. التأكيد وحده يستدعي `station_connect_admin_create_offer_discovery`؛ لا USSD عند فتح الصفحة أو كتابة الرقم. متابعة read-only بواسطة `station_connect_admin_offer_discovery_job` كل 3 ثوانٍ، بحد 60 قراءة/3 دقائق، ثم يبقى تحديث يدوي. نجاح الجلسة يعيد قراءة التصنيف لعرض Catalog المجموعة نفسها. لا Retry تلقائي، ولا تعذر شبكة = بلا عروض.
- قفل النقر المزدوج؛ حراسة كل رد Cache/Job/Queue متأخر بهوية الرقم وجيل المكوّن. فقد رد Queue يمنع طلبًا جديدًا حتى يثبت وجود الجلسة الجارية عبر القراءة؛ لا اعتبار غياب المرجع نجاحًا.
- تأكيد الإرسال المالي أصبح Modal controlled داخل شجرة React بدل `Modal.confirm` الساكن؛ يظهر الرقم والعرض والمصدر وتكلفة Sama (المبلغ+10). قفل إرسال متزامن. REVIEW المالي لا يعرض زر إنشاء طلب جديد/إلغاء مفتاح الطلب، ويظل الطلب محفوظًا.
- نسخة الواجهة ظاهرة وقابلة للنسخ في صفحة الدخول أيضًا (`src/main.tsx`) لإثبات ما حمّله المتصفح قبل تسجيل الدخول.
- `tests/flexy-recipient.test.mjs`: 11 اختبارًا مع React effects الحقيقية وRPC/UI stubs معزولة؛ نجحت حالات الرصيد الافتراضي، الهاتف، Cache صالح/منتهي، تأكيد ونقرة مزدوجة، polling، رد قديم، ضياع Queue، خطأ شبكة، حد polling، منع RPC الإدارة للعميل، وقفل REVIEW. الاختبارات لا تتصل بقاعدة أو مودم. GitHub Pages workflow يشغّلها قبل البناء.

**الحدود المثبتة:** Read-only DB يثبت Sama حديثة متصلة ومعتمدة وPIN محفوظ؛ لا ينقل ذلك إلى إثبات رصيد أو USSD من النسخة الحالية. Routes العرض: 18 Sama verified/enabled، و7 Arsselli draft/disabled. RPC المالي ما زال Sama-only، ولم نفعل Arsselli draft أو نحوله إلى رصيد عادي. الرصيد العادي والعملاء ماليًا/استعلام العملاء يبقون غير مفعّلين حتى مسار جاهز وصلاحية خادم مناسبة. نواة الرصيد التراكمي وبيانات MyTool لم تتغير.

**CI + WEB VERIFIED / ANDROID PWA PENDING:** المصدر `00392b524a087acb8b516b6033ad4d43aee6432f`؛ Actions `38394791189` نجح (11 اختبارًا + TypeScript/Vite + Pages deploy). بعد reload في متصفح الاختبار ظهر «نسخة الواجهة: 00392b5» في صفحة الدخول. هذا يثبت نسخة الويب فقط، لا PWA Android الخاصة بعمر ولا UI مسجل الدخول أو تجربة مودم فعلية. التأكيد النهائي لوصول PWA والاكتشاف الحقيقي عبر المحطة لا يزال PENDING. لم يُرسل أي USSD أو شحن ولم تكتب هذه المهمة أي بيانات DB. الخطوة القابلة للتحقق: SHA النسخة الجديدة ثم تجربة استكشاف واحدة بإذن الإدارة داخل الصفحة؛ تجربة مالية منفصلة بتأكيد عمر.

**أخطاء التحقق وتصحيحها:** TS2339 الأصلي تم حله في `96c78a8` ونجح CI؛ اختبار React المعزول احتاج إضافة `Descriptions` إلى UI stub ثم نجحت الاختبارات الـ11؛ استعلام قراءة افترض `station_uuid` مباشرة في SIM فرفضه PostgreSQL وصُحح الربط إلى `SIM.modem_uuid → Modem.station_uuid`. RPC جاهزية الإدارة رفض نداء SQL بلا سياق إدارة بـ`ADMIN_REQUIRED`؛ لم نضع هوية مصطنعة أو نخفف الحراسة، واعتمد تقرير الموارد التجميعي read-only. لا أثر كتابي على DB من هذه الأخطاء.


## 14. 2026-10-13 — Screenshot acceptance and discovery queue blocker

USER-PHONE-OBSERVED: first two screenshots are Flexy Mini on Android and display `d0c2585`; third is the real external comparison program, showing a single phone with credit/offers and Sama Mix/Talk/Net. Do not attribute its successful visible catalog to Flexy Mini. The screenshots confirm phone delivery of d0c2585 and signed-in offer UI, not discovery completion or financial success.

READ-ONLY DB: latest three discovery jobs remain claimed with one queued ussd_start each, no result/completion. Station heartbeat is fresh (Agent 0.4.10). `station_connect_claim_command` selects the oldest queued command first, then returns without claiming when its modem/session/SIM checks fail. Oldest queued record dates 2026-09-30, session open, modem stale and SIM no longer bound to that modem; other older queued records also have stale modems. This confirms a head-of-queue blocker in source plus current queue evidence; claimed on Job is not evidence that the Agent received USSD. No command was claimed by this inspection, no queue row mutated, no USSD initiated.

NEXT: fix stale-command queue handling in Station Connect with isolated tests, explicit expired/not-dispatched outcomes and SIM/session freshness; never replay expired commands, weaken identity checks, or blindly release old pending financial/Ooredoo requests. Verify after controlled deployment. UI should expose awaiting-station/time-out rather than indefinite misleading claimed. Preserve screenshot classification and no-secret documentation.


## 15. 2026-10-13 — مدة صلاحية الأوامر / USER-APPROVED + DB APPLIED

قرار عمر: الأوامر القديمة تلغيها Station بعد دقيقتين إلى دقيقتين ونصف. اعتمدنا **150 ثانية** للأمر المنتظر، مع منع التسليم بعد انتهاء المدة حتى لو عادت المحطة من انقطاع. الإلغاء المادي للسجل يتم عند heartbeat/claim التالي؛ لا Scheduler منفصل وقت انقطاع المحطة.

المالك: Station Connect / Server Adapter، source `eeb49a21f165cd3f2edebc54abf46ca291030eda`، migration `20261013122038_station_command_queue_ttl_150_seconds.sql` مطبقة ومسجلة. العقد والاختبارات والrollback: [Station queue expiry](https://github.com/amordz72/station-connect/blob/main/docs/COMMAND-QUEUE-EXPIRY.md). Agent 0.4.10 الموجود لم يتغير.

نجح اختبار rollback على الـSchema الفعلية قبل وبعد التطبيق: حد 149/150، الحراسة، تجاوز رأس غير جاهز، idempotency، عدم Retry، heartbeat، legacy queue، REVIEW عند وجود إرسال سابق، وعدم طمس رد أمر claimed. CI Station `38397700314` نجح. نتيجة الإنتاج: **8 أوامر قديمة ألغيت تلقائيًا؛ صفر أمر منتهي ما زال queued**؛ استعلامات العروض الثلاثة العالقة أصبحت failed / QUEUE_EXPIRED_NOT_DISPATCHED. لم نبدأ USSD أو شحنًا حقيقيًا، ولم نغيّر Master أو الرصيد التراكمي أو المحافظ. الأوامر claimed الفعلية لا تُلغى كأنها لم ترسل؛ نحتفظ بدليلها، وطلبات المال المرتبطة تبقى محجوزة/للمراجعة عبر metadata دون تسوية أموال.

خطأ الأداة: apply_migration أعاد Invalid or expired requestState مرتين؛ تحققنا من عدم التطبيق، ثم طبقنا SQL atomically بواسطة execute_sql وأثبتنا schema/history. No advisor notice names the new expiry functions. اختبار اكتشاف جديد على المودم ما زال PENDING؛ لا تعاد الطلبات المنتهية تلقائيًا.


## 16. 2026-10-13 — واجهة مباشرة وجدول العمليات / IMPLEMENTED + LOCAL TESTED

قرار عمر: كل صفحات التطبيق تعرض المعلومات الأساسية مباشرة وبأسلوب مهني؛ إزالة الشروحات المكررة وكتل التعليمات. صفحة الفليكسي تعرض آخر العمليات في **جدول ظاهر**: الرقم، الخدمة، اسم العرض، المبلغ، الحالة، التاريخ، رمز النتيجة ورد الشبكة كاملًا، وتفاصيل الردود لكل خطوة من الصف. مصدر `f687c9dc6effaa2c2d485a2f90a59865398caf0b`؛ التفاصيل في [CONCISE-UI-AND-OPERATION-TABLE.md](CONCISE-UI-AND-OPERATION-TABLE.md).

12 اختبار React/RPC وبناء TypeScript/Vite نجحوا. RPC `flexy_mini_admin_recent_operations` read-only مطبقة ومسجلة migration `20261013125748`، pagination من السيرفر، admin guard قبل البيانات، لا anon، ولا قيم أوامر/PIN صادرة؛ PIN المحفوظ يحجب داخل ردود الشبكة إن ظهر. اختبارات SQL rollback أثبتت الحراسة والpagination والرد الحقيقي الأخير دون إخراج أرقام خاصة أو أسرار. إعدادات المحطات والبطاقات والمحافظ والزبائن والموردين اختصرت الشروحات مع إبقاء البيانات وحدود الخدمة والتأكيد المالي والأخطاء.

الخلل التشغيلي الحالي المثبت: الاستعلام الجديد وصل المودم وأرجع `Please Enter your PIN code`؛ classifier لا يتعرف عليها (mot de passe/password فقط) فأغلق الجلسة بـDISCOVERY_TERMINAL. تحسين الجدول **لا يعني إصلاح parser**. التالي: جمع اختبارات وتجارب المشاريع السابقة ومراجعة lifecycle كامل ثم تصحيح/اختبار/نشر السيرفر، لا تكرار الطلب ولا اتهام PIN أو الاستنتاج أن المستفيد بلا عروض. CI/نسخة الهاتف الجديدة PENDING إلى حين إثباتها. لا USSD أو مال أو تغييرات بيانات MyTool في هذه الدفعة.


## 17. 2026-10-13 — PIN classifier / SOURCE + EDGE DEPLOYED, LIVE DISCOVERY PENDING

User's new recipient discovery reached the actual modem with `Please Enter your PIN code`, but Station gateway `isPinPrompt` recognized only `mot de passe`/`password` and released as `DISCOVERY_TERMINAL`. This was NOT a wrong PIN or recipient without offers. Prior Tehna/Core PIN/offer/menu/confirmation fixtures were checked before correction. See [Station PIN response record](https://github.com/amordz72/station-connect/blob/main/docs/SAMA-PIN-PROMPT-2026-10-13.md).

Station-owned fix: `pin-response.mjs` English/French/Arabic prompt and rejection classifier, server-only once-per-session `pin_submitted` guard, review on repeat, failed on explicit rejection, retained confirmation/menu/discovery flow. Source commits `0c55d125`, `310c2eb5`, `e4f24b60`, `32c0638c`, CI step `1fd29236`. Prior Edge `station-gateway` v20 had extra runtime routing absent from GitHub; synchronized with full running code instead of overwriting it. New Supabase Edge `station-gateway` **v21 ACTIVE**, 4 deployed file contents match GitHub. No Windows Agent update or DB migration. 27 isolated Node tests passed; GitHub Actions final conclusion not independently observed.

**Verification levels:** source UPDATED; offline tests PASS; Edge DEPLOYED/ACTIVE; actual PIN continuation on live Station **NOT YET TESTED**, no USSD triggered by this update, no financial send or ledger/MyTool mutation. Flexy Mini frontend remains the concise-table release `79ff678`. One explicit new recipient discovery through Flexy is now the single next live acceptance step: observe PIN command and menu result in the operation table. No surprise retry or real financial send.
