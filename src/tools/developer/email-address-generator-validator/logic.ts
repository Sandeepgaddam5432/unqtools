/**
 * Email Address Generator & Validator — pure logic.
 *
 * Generates and validates email addresses in layers: RFC 5322 simplified
 * syntax, domain/TLD sanity, disposable-provider detection, typo
 * suggestion, role-address flag. Provides batch processing, a deterministic
 * seeded PRNG for reproducible test data, and name-based generation.
 *
 * Pure functions only — no DOM, no network, no external deps.
 *
 * SANDBOX HONESTY CLAUSE: Generated addresses are structurally valid
 * (RFC 5322 syntax) but UNASSIGNED. They are for testing/development
 * only. Never use them to send real mail or sign up for services you
 * don't control.
 *
 * PRIVACY: The history feature stores only metadata (counts + timestamps),
 * NEVER the email addresses themselves. Addresses are never transmitted
 * or logged. There is no MX-record lookup — the tool is fully offline.
 */

// ---------------------------------------------------------------------------
// Bundled disposable-domain list (100+ providers)
// ---------------------------------------------------------------------------

/**
 * Curated list of 100+ known disposable / throwaway email domains.
 * Sourced from public lists (disposable-email-domains, mailchecker) as of
 * Jun 2026. Stored as a Set for O(1) lookup.
 */
export const DISPOSABLE_DOMAINS: readonly string[] = [
  "0-mail.com", "10minutemail.com", "10minutemail.net", "20minutemail.com",
  "2prong.com", "33mail.com", "4warding.com", "5mail.com",
  "6mail.com", "6paq.com", "7mail.com", "9mail.com",
  "a45.in", "abyssmail.com", "afrobacon.com", "airmail.cc",
  "amilegit.com", "anappfor.com", "anonbox.net", "anonmails.de",
  "armyspy.com", "artman-consumption.com", "azmeil.com", "baxomale.ht.cx",
  "beefmilk.com", "bigstring.com", "binkmail.com", "bio-muesli.com",
  "bobmail.info", "bofthew.com", "bootybay.de", "boun.cr",
  "bouncr.com", "boxformail.in", "breakthru.com", "brefmail.com",
  "bsnow.net", "bugmenot.com", "bund.us", "burnmail.uk",
  "buymoreplays.com", "c2.hu", "cachedot.net", "card.zp.ua",
  "casualdx.com", "cek.pm", "cellurl.com", "chamco.info",
  "cheatmail.de", "chickenkiller.com", "chogmail.com", "choicemail1.com",
  "clixser.com", "cmail.com", "cmail.net", "coldemail.info",
  "complementsuccess.com", "composto.com", "covertprofile.com", "crapmail.org",
  "crazymailing.com", "curryworld.de", "cust.in", "cuvox.de",
  "d3p.dk", "dacoolest.com", "daintly.com", "dayrep.com",
  "deadaddress.com", "deadchildren.org", "deadspam.com", "delikkt.de",
  "despam.it", "despammed.com", "devnullmail.com", "dfgh.net",
  "digitalsanctuary.com", "dingbone.com", "discard.email", "discardmail.com",
  "discardmail.de", "disposable-email.ml", "disposable.com", "disposablemail.com",
  "disposablemailaddresses.com", "dispostable.com", "dodgeit.com", "dodgit.com",
  "dodgit.org", "donemail.ru", "dontmail.com", "dontsendmespam.com",
  "drdrb.com", "droplar.com", "dump-email.info", "dumpandjunk.com",
  "dumpmail.de", "dumpyemail.com", "e-mail.com", "e-mail.org",
  "easytrashmail.com", "einrot.com", "eintagsmail.de", "email-fake.com",
  "email.cbes.net", "email60.com", "emailage.com", "emaildienst.de",
  "emailgo.de", "emailias.com", "emailigo.de", "emailinfive.com",
  "emailisvalid.com", "emaillime.com", "emailmiser.com", "emailproxsy.com",
  "emailresort.com", "emailsensei.com", "emailspam.de", "emailtemporanea.com",
  "emailtemporar.ro", "emailtemporary.com", "emailthe.net", "emailtmp.com",
  "emailto.de", "emailxfer.com", "emeil.in", "emeil.ir",
  "emz.net", "enterto.com", "ephemail.net", "ero-tube.org",
  "etranquil.com", "evopo.com", "explodemail.com", "express.net.ua",
  "eyepaste.com", "fake-mail.cf", "fake-mail.ga", "fake-mail.gq",
  "fake-mail.ml", "fakeinbox.com", "fakeinformation.com", "fakemail.fr",
  "fakemailgenerator.com", "fakemailz.com", "fammix.com", "fansworldwide.de",
  "fantasymail.de", "fastacura.com", "fastmail.net", "fastmail.fm",
  "fbi.hu", "fightallspam.com", "filzmail.com", "fivemail.de",
  "flimmerkiste.de", "fmailx.com", "fmgx.com", "footard.com",
  "forgetmail.com", "fr33mail.info", "frapmail.com", "freundin.ru",
  "friendlymail.co.uk", "fuckingduh.com", "fudgerub.com", "funnycodesnippets.com",
  "furusato.tokyo", "fyii.de", "garbagecollector.org", "garbagemail.org",
  "garrifulio.mailexpire.com", "gawab.com", "gehensiemirnichtaufdensack.de",
  "gelitik.in", "genderfuck.net", "getairmail.com", "getmails.eu",
  "getnada.com", "ghosttexter.de", "giaur.mooo.com", "girlsundertheinfluence.com",
  "gishpuppy.com", "gmial.com", "goemailgo.com", "gorillaswithdirtyarmpits.com",
  "gotmail.com", "gotti.otherinbox.com", "great-host.in", "greensloth.com",
  "greggamel.com", "greggml.com", "gsrv.co.uk", "guerillamail.com",
  "guerrillamail.com", "guerrillamailblock.com", "gustr.com", "harakirimail.com",
  "hat-geld.de", "hatespam.org", "haydoo.com", "heathenhammer.com",
  "herp.in", "hidemail.de", "hidzz.com", "hmamail.com",
  "hochsitze.com", "hopemail.biz", "hot-mail.cf", "hot-mail.gq",
  "hot-mail.ml", "hotmai.com", "hotmial.com", "hotnail.com",
  "hulapla.de", "hushmail.com", "hush.ai", "ieatspam.eu",
  "ieatspam.info", "ieh-mail.de", "illistnoise.com", "imails.info",
  "inbax.tk", "inbox.si", "inboxalias.com", "inboxclean.com",
  "inboxclean.org", "inboxdesigns.net", "inboxproxy.com", "inboxstore.com",
  "incognitomail.com", "incognitomail.net", "incognitomail.org", "infocom.zp.ua",
  "instant-mail.ru", "ip4t.it", "ip6.li", "ipoo.org",
  "irish2me.com", "iwi.net", "jamit.com.au", "jetable.com",
  "jetable.net", "jetable.org", "jnxjn.com", "jourrapide.com",
  "jsrsolutions.com", "junk1e.com", "junkmail.com", "junkmail.ga",
  "jwork.ru", "kasmail.com", "kaspop.com", "killmail.com",
  "killmail.net", "klassmaster.com", "klzlk.com", "koszmail.pl",
  "kulturbetrieb.info", "kurzepost.de", "lawlita.com", "lazyinbox.com",
  "leeching.net", "lellno.gq", "letmeinonthis.com", "lhsdv.com",
  "lifetotech.com", "link2mail.net", "litedrop.com", "lkgn.se",
  "locomodev.net", "login-email.ml", "lolfreak.net", "lolmail.biz",
  "lookugly.com", "lopl.co.cc", "lortemail.dk", "losemymail.com",
  "lovemeleaveme.com", "lpfmg.com", "lr78.com", "lroid.com",
  "lukop.dk", "m21.cc", "mail-filter.com", "mail-temporaire.com",
  "mail.by", "mail4trash.com", "mailadad.com", "mailaddressvalidator.com",
  "mailamax.com", "mailb.org", "mailbidon.com", "mailbiz.biz",
  "mailblocks.com", "mailbox52.com", "mailbox802.com", "mailbox92.com",
  "mailbucket.org", "mailcat.biz", "mailcatch.com", "mailchop.com",
  "maildrop.cc", "maildrop.cf", "maildrop.ga", "maildu.de",
  "mailfa.tk", "mailfall.com", "mailforspam.com", "mailfreeonline.com",
  "mailfs.com", "mailguard.me", "mailhazard.com", "mailhazard.us",
  "mailhz.me", "mailimate.com", "mailin8r.com", "mailinater.com",
  "mailinator.com", "mailinator.net", "mailinator.org", "mailinator2.com",
  "mailincubator.com", "mailismagic.com", "mailme.gq", "mailme.ir",
  "mailme.lv", "mailme24.com", "mailmetrash.com", "mailmoat.com",
  "mailmoth.com", "mailms.com", "mailnesia.com", "mailnull.com",
  "mailonaut.com", "mailorc.com", "mailorg.org", "mailpick.biz",
  "mailpooch.com", "mailproxsy.com", "mailquack.com", "mailrock.biz",
  "mailsac.com", "mailscrap.com", "mailseal.de", "mailshell.com",
  "mailsiphon.com", "mailslapping.com", "mailslite.com", "mailspark.com",
  "mailtemp.info", "mailtemp.net", "mailtemporaire.com", "mailtome.de",
  "mailtropy.com", "mailtrash.net", "mailtv.net", "mailtv.tv",
  "mailzi.ru", "mailzilla.com", "mailzilla.org", "makemetheking.com",
  "manybrain.com", "mbx.cc", "mcache.com", "mega.zik.dj",
  "meinspamschutz.de", "meltmail.com", "messagebeamer.de", "mezimages.net",
  "ministry-of-silly-walks.de", "mintemail.com", "misterpinball.de", "mjam.com",
  "mjukglass.nu", "moakt.com", "mobi.web.id", "mobileninja.co.uk",
  "moncourrier.com", "monemail.com", "monmail.com", "monumentmail.com",
  "moonwake.com", "mt2009.com", "mt2014.com", "mt2015.com",
  "my10minutemail.com", "mycard.net.ua", "mycleaninbox.net", "myemailboxy.com",
  "mymail-in.net", "mymailoasis.com", "mynetstore.de", "mypacks.net",
  "mysamp.de", "myspaceinc.com", "myspacepimpedup.com", "myspamless.com",
  "mytemp.email", "mytempemail.com", "mytrashmail.com", "nabuma.com",
  "neomailbox.com", "nepwk.com", "nervmich.net", "nervtmich.net",
  "netmails.com", "netmails.net", "netris.net", "netviewer-france.com",
  "nevermail.de", "nice-4u.com", "nincsmail.com", "nincsmail.hu",
  "nnh.com", "noblepioneer.com", "nomail.pdprojekt.net", "nomail.xl.cx",
  "nomail2me.com", "nomorespamemails.com", "nonspam.eu", "nonspammer.de",
  "noref.in", "norseforce.com", "nospam.ze.tc", "nospam4.us",
  "nospammail.net", "notmailinator.com", "nowhere.org", "nowmymail.com",
  "nurfuerspam.de", "nus.edu.sg", "nus.edu.sg.", "nwldx.com",
  "objectmail.com", "obobbo.com", "odnorazovoe.ru", "one-time.email",
  "oneoffemail.com", "oneoffmail.com", "onewaymail.com", "onlatedotcom.info",
  "online.ms", "opayq.com", "ordinaryamerican.net", "otherinbox.com",
  "ourklips.com", "outlawspam.com", "ovpn.to", "owlpic.com",
  "pancakemail.com", "paplease.com", "partybombe.de", "pcusers.otherinbox.com",
  "pepbot.com", "pfui.ru", "piki.si", "pimpedupmyspace.com",
  "pjskp.org", "pleaseplease.com", "plexolan.de", "plw.me",
  "pojok.ml", "politikerclub.de", "pooae.com", "poofy.org",
  "pookmail.com", "popmailserv.in", "popsmail.net", "privacy.net",
  "privatdemail.net", "privy-mail.com", "privymail.de", "pro-tag-macher.de",
  "promails.ru", "proxymail.eu", "prtnx.com", "punkass.com",
  "putthisinyourspamdatabase.com", "pwrby.com", "qasti.com", "qc.to",
  "qisdo.com", "qisoa.com", "qq.my", "qroxy.com",
  "r4nd0m.de", "radiku.ye.vc", "rbb-online.de", "rcpt.at",
  "re-gister.com", "realityconcept.net", "reallymymail.com", "recursive.moe",
  "recursor.net", "rejo.0x00000000.info", "reliable-mail.com", "royal.net",
  "rppkn.com", "rtrtr.com", "s0ny.net", "safe-mail.net",
  "safersignup.de", "safetymail.info", "safetypost.de", "saynotospams.com",
  "schachrol.com", "schmeissweg.tk", "schafmail.de", "schrott-email.de",
  "sd3ffghgjh.com", "secretemail.de", "secure-mail.biz", "seekapps.com",
  "sendfree.org", "sendnow.com", "senseless-entertainment.com", "server.ms",
  "services391.com", "sharedmailbox.org", "sharklasers.com", "shieldedmail.com",
  "shiftmail.com", "shitmail.me", "shitmail.org", "shitware.nl",
  "shmeriously.com", "shortmail.net", "shotmail.ru", "simpleitapps.com",
  "sinfonic.cl", "sinnlos-mail.de", "sino.com", "slapsfromlastnight.com",
  "slaskpost.se", "sly.io", "smapfree4me.de", "smapfree.net",
  "smashmail.de", "smellfear.com", "smellypotato.com", "smtp99.com",
  "smwg.info", "snakemail.com", "sneakemail.com", "sneakmail.de",
  "snkmail.com", "sofimail.com", "sofort-mail.de", "sofortmail.de",
  "softpls.asia", "sogetthis.com", "sohu.com", "soisz.com",
  "solvemail.info", "solventtrap.wiki", "spam.la", "spam.su",
  "spam4.me", "spamail.de", "spamavert.com", "spambob.com",
  "spambob.net", "spambob.org", "spambog.com", "spambog.de",
  "spambog.net", "spambog.ru", "spambooger.com", "spambox.info",
  "spambox.irishspringrealty.com", "spambox.org", "spambox.us", "spamcannon.com",
  "spamcannon.net", "spamcon.org", "spamcorptastic.com", "spamcowboy.com",
  "spamcowboy.net", "spamcowboy.org", "spamday.com", "spamdecoy.net",
  "spamex.com", "spamfighter.cf", "spamfighter.ga", "spamfighter.gq",
  "spamfighter.ml", "spamfighter.tk", "spamfree.eu", "spamfree.org",
  "spamgoes.in", "spamgourmet.com", "spamgourmet.net", "spamgourmet.org",
  "spamherelots.com", "spamhole.com", "spamify.com", "spaml.de",
  "spammotel.com", "spammy.net", "spamobox.com", "spamoff.de",
  "spamsphere.com", "spamslicer.com", "spamspot.com", "spamstack.net",
  "spamthis.co.uk", "spamthisplease.com", "spamtrail.com", "spamtroll.net",
  "spazmail.com", "speed.1s.fr", "spoofmail.de", "spybox.de",
  "squizzy.de", "squizzy.net", "squizzy.org", "squizzy.ws",
  "sr.ro", "sraka.net", "ssoia.com", "stanfordujjain.com",
  "starlight-breaker.net", "startfu.com", "startkeys.com", "statd.com",
  "stathy.com", "steadymail.com", "stethargus.com", "stinkefinger.net",
  "stop-my-spam.cf", "stop-my-spam.com", "stop-my-spam.ga", "stop-my-spam.ml",
  "stop-my-spam.tk", "streetwisemail.com", "stuffmail.de", "stumpfwerk.de",
  "suburbanthug.com", "suckmydays.com", "sudolife.me", "sudolife.net",
  "sudomail.biz", "sudomail.com", "sudomail.net", "suioe.com",
  "super-auswahl.de", "supergreatmail.com", "supermailer.jp", "superplatyna.com",
  "superrito.com", "superstachel.de", "suremail.info", "svk.jp",
  "swapff.com", "sweetxxx.de", "swift10minutemail.com", "sylvannet.com",
  "tafmail.com", "tafmail.net", "tarkheel.com", "techblast.ch",
  "techemail.com", "techgroup.me", "teewars.org", "teleosaurs.com",
  "teleworm.com", "teleworm.us", "temp-mail.com", "temp-mail.de",
  "temp-mail.org", "temp-mail.ru", "temp.emeraldwebmail.com", "temp.headstrong.de",
  "tempail.com", "tempalias.com", "tempe-mail.com", "tempemail.biz",
  "tempemail.co.za", "tempemail.com", "tempemail.net", "tempemail.org",
  "tempinbox.co.uk", "tempinbox.com", "tempmail.co.uk", "tempmail.com",
  "tempmail.de", "tempmail.it", "tempmail.net", "tempmail.org",
  "tempmail.us", "tempmail2.com", "tempmaildemo.com", "tempmailer.com",
  "tempmailer.de", "tempmailo.com", "tempomail.fr", "temporarily.de",
  "temporaryemail.net", "temporaryemail.us", "temporaryforwarding.com", "temporaryinbox.com",
  "temporarymailaddress.com", "tempthe.net", "thc.st", "thecloudindex.com",
  "thediamants.org", "thelimestones.com", "themostemail.com", "thex.ro",
  "thietbixin.com", "thisisnotmyrealemail.com", "thismail.net", "thraml.com",
  "thrma.com", "throwam.com", "throwawayemailaddress.com", "throwawaymail.com",
  "throwawaymail.com.com", "throwawaymail.info", "throwawaymail.net", "throwawaymail.org",
  "thrxmail.com", "tilien.com", "tittbit.in", "tizi.com",
  "tmail.com", "tmail.net", "tmail.ws", "tmailinator.com",
  "tmpeml.info", "tmpjr.me", "tmpmail.net", "tmpmail.org",
  "tnctr.com", "toddsbighug.com", "toiea.com", "tokem.co",
  "topeni.cz", "tradermail.info", "trayna.com", "trbvm.com",
  "trbvn.com", "trbvo.com", "trickmail.net", "trillianpro.com",
  "trollproject.com", "tropicalbass.info", "trucker.net", "tucumcaritonite.com",
  "turoid.com", "tvchd.com", "twinmail.de", "twoweirdtricks.com",
  "tyldd.com", "ubismail.net", "ubm.md", "ucche.us",
  "ufacturing.com", "uggsrock.com", "uhhu.ru", "umail.net",
  "unimark.org", "unmail.com", "upliftnow.com", "upliftnow.com",
  "upozowac.info", "urfunktion.se", "uroid.com", "us.af",
  "username.e4ward.com", "ushijima-love.com", "utiket.us", "uu.gl",
  "uu2.net", "uyhip.com", "vaati.org", "valemail.net",
  "valhalladev.com", "vankin.de", "vctel.com", "vda.ru",
  "vdisya.com", "venompen.com", "verdejo.com", "veryday.ch",
  "veryday.eu", "veryday.info", "vgd8.org", "vip.188.com",
  "vip.21cn.com", "vip.263.net", "vip.sina.com", "vip.sohu.com",
  "vip.tom.com", "vipyahoo.com", "viralplays.com", "viralurl.com",
  "visal007.tk", "visal168.tk", "vkcode.ru", "vmani.com",
  "vmpanda.com", "vnedu.us", "voidbay.com", "vomoto.com",
  "vorga.org", "vorova.com", "vote-smart.org", "voxelcore.com",
  "vpn.st", "vsimcard.com", "vubby.com", "walala.org",
  "walkmail.net", "walkmail.ru", "wasteland.rfc822.org", "watchever.net",
  "watchfull.net", "wbmail.net", "we.qq.com", "wee.my",
  "wef.gr", "wfgdf.net", "wh4f.org", "whatiaas.com",
  "whatsaas.com", "whiffles.org", "whopy.com", "whtjddn.33mail.com",
  "whyspam.me", "wickmail.net", "widget.gg", "wikidocracy.com",
  "wimsg.com", "winemaven.info", "wuzup.net", "wuzup.mail.net",
  "wuzup.net", "www.bccto.com", "www.e4ward.com", "www.mailinator.com",
  "www.newyork.com", "x24.com", "xagloo.com", "xents.com",
  "xjoi.com", "xl.cx", "xmail.com", "xmaily.com",
  "xn--9kq967o.com", "xoxox.cc", "xrho.com", "xwaretech.com",
  "xwaretech.info", "xwaretech.net", "xy9ce.tk", "xyzfree.net",
  "yapped.net", "yapped.ru", "ya.ru", "yaho.com",
  "yahomail.com", "yahooproducts.com", "yamail.com", "yawmail.com",
  "ycare.de", "ye.vc", "yep.it", "ymail.com",
  "yodx.ro", "yogamaven.com", "yomail.com", "yoo.ws",
  "yopmail.com", "yopmail.fr", "yopmail.net", "yopmail.org",
  "yopmail.us", "yopomail.com", "yopweb.com", "you-spam.com",
  "yougotgoated.com", "youmailr.com", "youpy.com", "yourdomain.com",
  "yourlifesucks.com", "yourspam.co.uk", "yourtube.com", "yroid.com",
  "ytpayy.com", "yuurok.com", "yxzx.net", "yyolfmail.com",
  "z0d.eu", "z1p.biz", "z86.ru", "zaktouni.fr",
  "zebins.com", "zebins.eu", "zehnminuten.de", "zehnminutenmail.de",
  "zepp.dk", "zetmail.com", "zippymail.info", "zipsend.com",
  "zoaxe.com", "zoemail.com", "zoemail.net", "zoetropic.email",
  "zombie-hive.com", "zomg.info", "zumpul.com", "zv68.com",
];

/** Set form for O(1) lookup. */
export const DISPOSABLE_DOMAIN_SET: Set<string> = new Set(
  DISPOSABLE_DOMAINS.map((d) => d.toLowerCase()),
);

// ---------------------------------------------------------------------------
// Common provider domains + typos
// ---------------------------------------------------------------------------

/** Real common provider domains for generation and typo detection. */
export const COMMON_DOMAINS: readonly string[] = [
  "gmail.com", "outlook.com", "hotmail.com", "yahoo.com",
  "proton.me", "protonmail.com", "icloud.com", "aol.com",
  "zoho.com", "gmx.com", "yandex.com", "fastmail.com",
  "mail.com", "msn.com", "live.com",
];

/** Common domain typos → correct domain. */
export const DOMAIN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gnail.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gemail.com": "gmail.com",
  "hotnail.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloook.com": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahoomail.com": "yahoo.com",
  "yhaoo.com": "yahoo.com",
  "yahou.com": "yahoo.com",
  "iclod.com": "icloud.com",
  "icluod.com": "icloud.com",
  "protonmai.com": "protonmail.com",
  "protommail.com": "protonmail.com",
  "protonmaill.com": "protonmail.com",
  "yandx.com": "yandex.com",
  "yanedx.com": "yandex.com",
  "fastmai.com": "fastmail.com",
  "fastmaill.com": "fastmail.com",
};

/** Role-based local parts that should be flagged. */
export const ROLE_LOCALPARTS: readonly string[] = [
  "info", "admin", "administrator", "webmaster", "postmaster",
  "hostmaster", "usenet", "news", "www", "web", "root",
  "sysadmin", "sysop", "operator", "support", "help", "contact",
  "sales", "marketing", "billing", "accounts", "accounting",
  "service", "team", "office", "secretary", "noreply", "no-reply",
  "donotreply", "do-not-reply", "unsubscribe", "abuse", "security",
  "spam", "mail", "daemon", "mailer-daemon", "ftp", "smtp", "pop",
];

/** Set form for role-local-part lookup. */
export const ROLE_LOCALPART_SET: Set<string> = new Set(
  ROLE_LOCALPARTS.map((s) => s.toLowerCase()),
);

// ---------------------------------------------------------------------------
// PRNG — deterministic mulberry32
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(seed: string | number): number {
  if (typeof seed === "number" && Number.isFinite(seed)) return seed >>> 0;
  const str = String(seed);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  letter(lower?: boolean): string;
  digit(): string;
}

export function createRng(seed: string | number): Rng {
  const r = mulberry32(hashSeed(seed));
  const int = (min: number, max: number): number =>
    Math.floor(r() * (max - min + 1)) + min;
  const pick = <T,>(arr: readonly T[]): T => {
    if (arr.length === 0) throw new Error("pick: empty array");
    return arr[Math.floor(r() * arr.length)] as T;
  };
  const letter = (lower = true): string => {
    const c = String.fromCharCode(97 + int(0, 25));
    return lower ? c : c.toUpperCase();
  };
  const digit = (): string => String(int(0, 9));
  return { next: r, int, pick, letter, digit };
}

// ---------------------------------------------------------------------------
// Normalization & parsing
// ---------------------------------------------------------------------------

/** Lowercase, trim whitespace. Does NOT strip valid RFC characters. */
export function normalizeEmail(input: string): string {
  return (input || "").trim().toLowerCase();
}

export interface ParsedEmail {
  local: string;
  domain: string;
  /** True if local-part was quoted ("..." form). */
  quoted: boolean;
  /** Plus-addressing tag, if present (user+tag → tag). */
  plusTag: string | null;
  /** Base local-part without plus-tag. */
  baseLocal: string;
}

/**
 * Parse an email address into local-part and domain.
 * Returns null if there's no '@' or structure is malformed.
 */
export function parseEmail(input: string): ParsedEmail | null {
  const email = normalizeEmail(input);
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return null;
  let local = email.slice(0, at);
  const domain = email.slice(at + 1);
  let quoted = false;
  if (local.startsWith('"') && local.endsWith('"') && local.length >= 2) {
    quoted = true;
  }
  // Extract plus-tag if not quoted.
  let plusTag: string | null = null;
  let baseLocal = local;
  if (!quoted) {
    const plusIdx = local.indexOf("+");
    if (plusIdx > 0) {
      plusTag = local.slice(plusIdx + 1);
      baseLocal = local.slice(0, plusIdx);
    }
  }
  return { local, domain, quoted, plusTag, baseLocal };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type EmailValidationCode =
  | "valid"
  | "empty"
  | "no_at"
  | "empty_local"
  | "empty_domain"
  | "local_too_long"
  | "domain_too_long"
  | "bad_local_chars"
  | "bad_domain_chars"
  | "bad_domain_structure"
  | "bad_tld"
  | "quoted_unescaped";

export interface EmailValidationResult {
  input: string;
  normalized: string;
  valid: boolean;
  code: EmailValidationCode;
  message: string;
  local: string;
  /** Base local-part with plus-tag stripped (only when unquoted). */
  baseLocal: string;
  domain: string;
  tld: string | null;
  isDisposable: boolean;
  isRole: boolean;
  typoSuggestion: string | null;
  plusTag: string | null;
}

/**
 * Validate an email address with RFC 5322 simplified syntax, domain/TLD
 * sanity, disposable-provider detection, typo suggestion, and role flag.
 */
export function validateEmail(input: string): EmailValidationResult {
  const normalized = normalizeEmail(input);

  if (!normalized) {
    return emptyResult(input, normalized, "empty", "Email address is empty");
  }
  if (!normalized.includes("@")) {
    return emptyResult(input, normalized, "no_at", "Missing '@' separator");
  }

  const parsed = parseEmail(normalized);
  if (!parsed) {
    return emptyResult(input, normalized, "no_at", "Malformed email — no usable '@' separator");
  }
  const { local, domain, quoted, plusTag, baseLocal } = parsed;

  if (!local) {
    return emptyResult(input, normalized, "empty_local", "Local-part (before '@') is empty");
  }
  if (!domain) {
    return emptyResult(input, normalized, "empty_domain", "Domain (after '@') is empty");
  }
  if (local.length > 64) {
    return emptyResult(input, normalized, "local_too_long", `Local-part too long (max 64, got ${local.length})`);
  }
  if (domain.length > 255) {
    return emptyResult(input, normalized, "domain_too_long", `Domain too long (max 255, got ${domain.length})`);
  }

  // Validate local-part.
  if (!quoted) {
    if (!isValidUnquotedLocal(baseLocal)) {
      return emptyResult(input, normalized, "bad_local_chars", "Local-part contains invalid characters or starts/ends with a dot");
    }
  } else {
    if (!isValidQuotedLocal(local)) {
      return emptyResult(input, normalized, "quoted_unescaped", "Quoted local-part has unescaped characters");
    }
  }

  // Validate domain structure.
  if (!isValidDomain(domain)) {
    return emptyResult(input, normalized, "bad_domain_structure", "Domain has invalid structure (must be labels separated by dots)");
  }
  const labels = domain.split(".");
  for (const label of labels) {
    if (!isValidDomainLabel(label)) {
      return emptyResult(input, normalized, "bad_domain_chars", `Domain label '${label}' contains invalid characters or starts/ends with a hyphen`);
    }
  }

  // Validate TLD (last label).
  const tld = labels[labels.length - 1]!;
  if (!isValidTld(tld)) {
    return emptyResult(input, normalized, "bad_tld", `TLD '${tld}' must be at least 2 letters`);
  }

  // Detect disposable.
  const isDisposable = DISPOSABLE_DOMAIN_SET.has(domain);

  // Detect role address.
  const isRole = !quoted && ROLE_LOCALPART_SET.has(baseLocal);

  // Detect typo.
  const typoSuggestion = DOMAIN_TYPOS[domain] ?? null;

  // Final verdict.
  let code: EmailValidationCode = "valid";
  let message = "Valid email — passes RFC 5322 simplified syntax";
  if (isDisposable) {
    message = "Valid format but domain is a known disposable/throwaway provider";
  } else if (isRole) {
    message = "Valid format but local-part is a role address (info@, admin@, etc.)";
  } else if (typoSuggestion) {
    message = `Valid format — did you mean ${baseLocal}@${typoSuggestion}?`;
  }

  return {
    input, normalized,
    valid: true,
    code,
    message,
    local, baseLocal, domain, tld,
    isDisposable, isRole, typoSuggestion,
    plusTag,
  };
}

function emptyResult(
  input: string,
  normalized: string,
  code: EmailValidationCode,
  message: string,
): EmailValidationResult {
  return {
    input, normalized,
    valid: false,
    code, message,
    local: "", baseLocal: "", domain: "", tld: null,
    isDisposable: false, isRole: false, typoSuggestion: null,
    plusTag: null,
  };
}

/** Validate an unquoted local-part per RFC 5322 simplified rules. */
export function isValidUnquotedLocal(local: string): boolean {
  if (!local || local.length > 64) return false;
  if (local.startsWith(".") || local.endsWith(".")) return false;
  if (local.includes("..")) return false;
  // Allowed: a-z 0-9 and these specials: ! # $ % & ' * + - / = ? ^ _ ` { | } ~ .
  // We've already lowercased, so we only need a-z (lowercase).
  return /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local);
}

/** Validate a quoted local-part. Permits any chars inside, with escapes via backslash. */
export function isValidQuotedLocal(local: string): boolean {
  if (!local || local.length < 2) return false;
  if (!local.startsWith('"') || !local.endsWith('"')) return false;
  const inner = local.slice(1, -1);
  // Inside quotes, most chars are allowed. Backslash escapes the next char.
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]!;
    if (ch === "\\") {
      // Backslash must be followed by something.
      if (i + 1 >= inner.length) return false;
      i++; // skip next char (it's escaped)
    } else if (ch === '"') {
      // Unescaped double-quote inside is invalid.
      return false;
    }
  }
  return true;
}

/** Validate the overall domain structure (labels separated by dots). */
export function isValidDomain(domain: string): boolean {
  if (!domain) return false;
  if (domain.length > 255) return false;
  if (domain.startsWith(".") || domain.endsWith(".")) return false;
  if (domain.includes("..")) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  return true;
}

/** Validate a single domain label. */
export function isValidDomainLabel(label: string): boolean {
  if (!label) return false;
  if (label.length > 63) return false;
  // Letters, digits, hyphens. Must not start or end with hyphen.
  if (!/^[a-z0-9-]+$/.test(label)) return false;
  if (label.startsWith("-") || label.endsWith("-")) return false;
  return true;
}

/** Validate a TLD — must be at least 2 alphabetic chars. */
export function isValidTld(tld: string): boolean {
  if (!tld) return false;
  return /^[a-z]{2,}$/.test(tld);
}

/** Check if a domain is in the disposable list. */
export function isDisposableDomain(domain: string): boolean {
  return DISPOSABLE_DOMAIN_SET.has(normalizeEmail(domain));
}

/** Check if a local-part is a role address. */
export function isRoleLocalPart(local: string): boolean {
  const base = normalizeEmail(local).split("+")[0]!;
  return ROLE_LOCALPART_SET.has(base);
}

/** Suggest a typo correction for a domain, or null. */
export function suggestDomainTypo(domain: string): string | null {
  const d = normalizeEmail(domain);
  return DOMAIN_TYPOS[d] ?? null;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/** Name-based generation format templates. {F} = first, {L} = last, {I} = initial. */
export type NameFormat =
  | "first.last"
  | "firstlast"
  | "flast"
  | "firstl"
  | "last.first"
  | "lastfirst"
  | "lastf"
  | "lfirst"
  | "f_last"
  | "first";

export const NAME_FORMATS: NameFormat[] = [
  "first.last", "firstlast", "flast", "firstl",
  "last.first", "lastfirst", "lastf", "lfirst",
  "f_last", "first",
];

export interface GenerateOptions {
  /** Mode: random local-parts or name-based. */
  mode: "random" | "name";
  /** Number of addresses to generate (max 1000). */
  count: number;
  /** Domain to use (defaults to a random common provider). */
  domain?: string;
  /** First name (for name mode). */
  firstName?: string;
  /** Last name (for name mode). */
  lastName?: string;
  /** Format template (for name mode). Defaults to first.last. */
  format?: NameFormat;
  /** Random seed for reproducibility. */
  seed?: string | number;
}

const RANDOM_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomLocal(rng: Rng, minLen = 6, maxLen = 10): string {
  const len = rng.int(minLen, maxLen);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += RANDOM_CHARS[Math.floor(rng.next() * RANDOM_CHARS.length)];
  }
  return out;
}

/** Render a name-based local-part from first/last + format. */
export function renderNameLocal(first: string, last: string, format: NameFormat): string {
  const f = (first || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const l = (last || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const fi = f.slice(0, 1);
  const li = l.slice(0, 1);
  switch (format) {
    case "first.last": return `${f}.${l}`;
    case "firstlast": return `${f}${l}`;
    case "flast": return `${fi}${l}`;
    case "firstl": return `${f}${li}`;
    case "last.first": return `${l}.${f}`;
    case "lastfirst": return `${l}${f}`;
    case "lastf": return `${l}${fi}`;
    case "lfirst": return `${li}${f}`;
    case "f_last": return `${f}_${l}`;
    case "first": return f;
    default: return `${f}.${l}`;
  }
}

/** Generate a single email address. */
export function generateEmail(opts: GenerateOptions, rng: Rng): string {
  const domain = (opts.domain || rng.pick(COMMON_DOMAINS)).toLowerCase();
  if (opts.mode === "name") {
    const first = opts.firstName || rng.pick(["alice", "bob", "carol", "david", "eve"]);
    const last = opts.lastName || rng.pick(["smith", "jones", "lee", "patel", "garcia"]);
    const format = opts.format ?? "first.last";
    const local = renderNameLocal(first, last, format);
    return `${local}@${domain}`;
  }
  // Random mode.
  return `${randomLocal(rng)}@${domain}`;
}

/** Generate a batch of test email addresses (max 1000 per call). */
export function generateEmailBatch(opts: GenerateOptions): string[] {
  const seed = opts.seed ?? Math.random().toString(36).slice(2);
  const rng = createRng(seed);
  const n = Math.max(0, Math.min(opts.count, 1000));
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(generateEmail(opts, rng));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Formatting & masking
// ---------------------------------------------------------------------------

/** Mask the local-part, keeping the first char + domain. */
export function maskEmail(input: string): string {
  const parsed = parseEmail(input);
  if (!parsed) return input;
  const { local, domain } = parsed;
  if (local.length <= 1) return `${local}@${domain}`;
  return `${local[0]}${"•".repeat(Math.min(local.length - 1, 6))}@${domain}`;
}

// ---------------------------------------------------------------------------
// Batch validation
// ---------------------------------------------------------------------------

export interface BatchRow {
  index: number;
  raw: string;
  normalized: string;
  valid: boolean;
  code: EmailValidationCode;
  message: string;
  isDisposable: boolean;
  isRole: boolean;
  typoSuggestion: string | null;
  tld: string | null;
}

/** Parse batch input — one address per line (commas/semicolons also accepted). */
export function parseBatchInput(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Validate a list of email addresses. */
export function validateBatch(emails: string[]): BatchRow[] {
  return emails.map((raw, index) => {
    const r = validateEmail(raw);
    return {
      index,
      raw,
      normalized: r.normalized,
      valid: r.valid,
      code: r.code,
      message: r.message,
      isDisposable: r.isDisposable,
      isRole: r.isRole,
      typoSuggestion: r.typoSuggestion,
      tld: r.tld,
    };
  });
}

export interface BatchSummary {
  total: number;
  valid: number;
  invalid: number;
  disposable: number;
  role: number;
  typos: number;
  byTld: Record<string, number>;
}

export function summarizeBatch(rows: BatchRow[]): BatchSummary {
  const byTld: Record<string, number> = {};
  let valid = 0;
  let disposable = 0;
  let role = 0;
  let typos = 0;
  for (const r of rows) {
    if (r.valid) valid++;
    if (r.isDisposable) disposable++;
    if (r.isRole) role++;
    if (r.typoSuggestion) typos++;
    const k = r.tld || "—";
    byTld[k] = (byTld[k] ?? 0) + 1;
  }
  return {
    total: rows.length,
    valid,
    invalid: rows.length - valid,
    disposable,
    role,
    typos,
    byTld,
  };
}

/** Render batch rows as CSV. */
export function renderBatchCsv(rows: BatchRow[]): string {
  const headers = ["index", "raw", "normalized", "valid", "code", "disposable", "role", "typo", "tld", "message"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      String(r.index),
      escapeCsvCell(r.raw),
      escapeCsvCell(r.normalized),
      r.valid ? "valid" : "invalid",
      r.code,
      r.isDisposable ? "disposable" : "",
      r.isRole ? "role" : "",
      escapeCsvCell(r.typoSuggestion || ""),
      escapeCsvCell(r.tld || ""),
      escapeCsvCell(r.message),
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsvCell(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------------------------------------------------------------------------
// Canonical test vectors (RFC 5322 sample addresses)
// ---------------------------------------------------------------------------

/**
 * Known-good RFC 5322 email test vectors sourced from public RFC examples
 * and Wikipedia's "Email address" article (Jun 2026).
 */
export const CANONICAL_VALID_EMAILS: readonly { email: string; note: string }[] = [
  { email: "simple@example.com", note: "Wikipedia simple example" },
  { email: "very.common@example.com", note: "Wikipedia common example" },
  { email: "disposable.style.email.with+symbol@example.com", note: "Wikipedia plus-tag example" },
  { email: "other.email-with-hyphen@example.com", note: "Hyphen in local-part" },
  { email: "fully-qualified-domain@example.com", note: "Hyphen in domain label" },
  { email: "user.name+tag+sorting@example.com", note: "Multiple plus-tags" },
  { email: "x@example.com", note: "One-letter local-part" },
  { email: "example-indeed@strange-example.com", note: "Hyphen in domain" },
  { email: "test/test@test.com", note: "Slash in local-part" },
  { email: "user@example.co.uk", note: "Multi-label TLD" },
  { email: "a@b.cd", note: "Minimal length example" },
  { email: '"much.more unusual"@example.com', note: "Quoted local-part" },
];

/** Emails that should fail validation. */
export const CANONICAL_INVALID_EMAILS: readonly { email: string; note: string }[] = [
  { email: "Abc.example.com", note: "Missing '@'" },
  { email: "A@b@c@example.com", note: "Multiple '@'" },
  { email: 'a"b(c)d,e:f;g<h>i[j\\k]l@example.com', note: "Special chars outside quotes" },
  { email: 'just"not"right@example.com', note: "Quoted strings must be dot-separated" },
  { email: "this is\"not\\allowed@example.com", note: "Spaces, escapes, quotes not allowed unquoted" },
  { email: "this\\ still\\not\\allowed@example.com", note: "Backslash escapes not allowed unquoted" },
  { email: "user@", note: "Empty domain" },
  { email: "@example.com", note: "Empty local-part" },
  { email: "user@.com", note: "Domain starts with dot" },
  { email: "user@example.c", note: "TLD too short (1 char)" },
  { email: "user@example..com", note: "Double dot in domain" },
  { email: "", note: "Empty input" },
];

// ---------------------------------------------------------------------------
// History (localStorage) — stores metadata only, NEVER addresses
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:email-address-generator-validator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  action: "generate" | "validate_single" | "validate_batch";
  mode: "random" | "name" | null;
  domain: string | null;
  generateCount: number;
  batchTotal: number;
  batchValid: number;
  batchInvalid: number;
  batchDisposable: number;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(
  mode: "random" | "name",
  count: number,
  domain: string,
  format: NameFormat,
): string {
  const params = new URLSearchParams();
  params.set("mode", mode);
  if (count) params.set("count", String(count));
  if (domain) params.set("domain", domain);
  if (format) params.set("fmt", format);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(
  hash: string,
): { mode: "random" | "name"; count: number; domain: string; format: NameFormat } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { mode: "random", count: 10, domain: "", format: "first.last" };
  const params = new URLSearchParams(clean);
  const m = params.get("mode") ?? "random";
  const mode: "random" | "name" = m === "name" ? "name" : "random";
  const countStr = params.get("count") ?? "10";
  const parsedCount = parseInt(countStr, 10);
  const count = Number.isNaN(parsedCount) ? 10 : Math.max(1, Math.min(1000, parsedCount));
  const domain = params.get("domain") ?? "";
  const fmt = params.get("fmt") ?? "first.last";
  const format: NameFormat = NAME_FORMATS.includes(fmt as NameFormat) ? (fmt as NameFormat) : "first.last";
  return { mode, count, domain, format };
}

// ---------------------------------------------------------------------------
// Honesty banner
// ---------------------------------------------------------------------------

export const HONESTY_BANNER =
  "Generated email addresses are structurally valid (RFC 5322 syntax) but UNASSIGNED. They are for testing/development only — never use them to send real mail or sign up for services you don't control.";
