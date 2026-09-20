PRIX = 29.90          # HT, abonnement mensuel a dispo
TJM  = 300.0          # cout d une journee de developpement

# --- BNP Axepta, releve sur la proposition -------------------------------
BNP_ABO   = 18.00     # EUR HT / mois, offert 6 mois
BNP_INCL  = 100       # operations incluses
BNP_TX    = 0.22      # EUR HT au-dela du forfait
# Taux d acquisition VADS, par type de carte
ACQ = {
 "debit perso EEE":   (0.0027, 0.0, 0.05),
 "credit perso EEE":  (0.0037, 0.0, 0.05),
 "comm. CB EEE":      (0.0094, 0.0, 0.05),
 "comm. Visa EEE":    (0.0172, 0.0, 0.05),
 "comm. MC EEE":      (0.0197, 0.0, 0.05),
 "hors EEE perso":    (0.0155, 0.12, 0.0),
}
# --- Stripe, releve sur stripe.com/fr/pricing le 20/09/2026 --------------
ST_STD   = (0.015, 0.25)   # carte EEE standard
ST_PREM  = (0.028, 0.25)   # carte EEE "premium" = cartes commerciales
ST_SEPA  = 0.35            # prelevement SEPA, forfait fixe
ST_BILL  = 0.007           # Stripe Billing, % du volume recurrent
# --- GoCardless Standard --------------------------------------------------
GC = (0.01, 0.20, 2.00)    # 1% + 0,20 EUR, plafonne a 2 EUR

MIX = {
 "H1 cartes perso": {"debit perso EEE":.75, "credit perso EEE":.25},
 "H2 realiste B2B": {"debit perso EEE":.45,"credit perso EEE":.15,
                     "comm. CB EEE":.25,"comm. Visa EEE":.10,"comm. MC EEE":.05},
}

def bnp_tx(mix, prix=PRIX):
    c=0.0
    for carte,part in mix.items():
        taux,fixe,mini=ACQ[carte]
        c += part*max(taux*prix+fixe, mini)
    return c

def bnp_mois(n, mix, prix=PRIX, abo=True):
    ops=n
    cout = (BNP_ABO if abo else 0.0) + max(0, ops-BNP_INCL)*BNP_TX + ops*bnp_tx(mix,prix)
    return cout

def stripe_carte_tx(part_premium, prix=PRIX, billing=True):
    std = ST_STD[0]*prix+ST_STD[1]
    pre = ST_PREM[0]*prix+ST_PREM[1]
    c = (1-part_premium)*std + part_premium*pre
    if billing: c += ST_BILL*prix
    return c

def stripe_sepa_tx(prix=PRIX, billing=True):
    return ST_SEPA + (ST_BILL*prix if billing else 0.0)

def gc_tx(prix=PRIX):
    return min(GC[0]*prix+GC[1], GC[2])

print("="*78)
print("COUT D UNE TRANSACTION DE %.2f EUR HT" % PRIX)
print("="*78)
for nom,mix in MIX.items():
    pp = sum(v for k,v in mix.items() if k.startswith("comm."))
    print("\n  %s  (part de cartes commerciales : %.0f %%)" % (nom, pp*100))
    print("    BNP acquisition seule          %.4f EUR  (%.3f %%)" % (bnp_tx(mix), bnp_tx(mix)/PRIX*100))
    print("    BNP acquisition + 0,22 passerelle %.4f EUR" % (bnp_tx(mix)+BNP_TX))
    print("    Stripe carte + Billing         %.4f EUR  (%.3f %%)" % (stripe_carte_tx(pp), stripe_carte_tx(pp)/PRIX*100))
    print("    Stripe carte sans Billing      %.4f EUR" % stripe_carte_tx(pp, billing=False))
print("\n  Independant du mix :")
print("    Stripe SEPA + Billing          %.4f EUR  (%.3f %%)" % (stripe_sepa_tx(), stripe_sepa_tx()/PRIX*100))
print("    Stripe SEPA sans Billing       %.4f EUR  (%.3f %%)" % (stripe_sepa_tx(billing=False), stripe_sepa_tx(billing=False)/PRIX*100))
print("    GoCardless SEPA Standard       %.4f EUR  (%.3f %%)" % (gc_tx(), gc_tx()/PRIX*100))

print("\n"+"="*78)
print("SCENARIOS, COUT MENSUEL TOTAL (hors 6 mois offerts BNP)")
print("="*78)
print("%8s %10s | %11s %11s | %11s %11s | %11s" % (
  "abonnes","CA/mois","BNP H1","BNP H2","Stripe H1","Stripe H2","Stripe SEPA"))
lignes=[]
for n in (100,500,1000,5000,10000):
    ca=n*PRIX
    b1=bnp_mois(n,MIX["H1 cartes perso"]); b2=bnp_mois(n,MIX["H2 realiste B2B"])
    s1=n*stripe_carte_tx(0.0); s2=n*stripe_carte_tx(0.40); ss=n*stripe_sepa_tx()
    lignes.append((n,ca,b1,b2,s1,s2,ss))
    print("%8d %9.0f€ | %8.0f€ %5.2f%% %8.0f€ %5.2f%% | %8.0f€ %5.2f%% %8.0f€ %5.2f%% | %8.0f€ %5.2f%%" % (
      n,ca,b1,b1/ca*100,b2,b2/ca*100,s1,s1/ca*100,s2,s2/ca*100,ss,ss/ca*100))

print("\n"+"="*78)
print("SEUIL : combien d abonnes pour rembourser le developpement de l abonnement ?")
print("="*78)
print("BNP Axepta est une passerelle de paiement : aucun moteur d abonnement,")
print("ni facturation, ni relance d impaye, ni coupon. Il faut l ecrire.")
for jours in (15,20,25):
    surcout = jours*TJM
    print("\n  Si ce moteur coute %d jours (%.0f EUR) :" % (jours,surcout))
    for etiq, mix, pp in (("H1 cartes perso",MIX["H1 cartes perso"],0.0),
                          ("H2 realiste B2B",MIX["H2 realiste B2B"],0.40)):
        eco_tx = stripe_carte_tx(pp) - (bnp_tx(mix)+BNP_TX)
        if eco_tx<=0:
            print("    %-16s BNP n est JAMAIS moins cher (ecart %.4f EUR/tx)"%(etiq,eco_tx)); continue
        # BNP a aussi 18 EUR/mois fixes : economie mensuelle = n*eco_tx - 18
        # n tel que (n*eco_tx - 18)*mois = surcout
        for mois in (12,24,36):
            besoin = (surcout/mois + BNP_ABO)/eco_tx
            print("    %-16s vs Stripe carte : %6.0f abonnes pour rentrer en %d mois (ecart %.3f EUR/tx)"%(etiq,besoin,mois,eco_tx))
        eco_sepa = stripe_sepa_tx() - (bnp_tx(mix)+BNP_TX)
        if eco_sepa<=0:
            print("    %-16s vs Stripe SEPA  : BNP n est JAMAIS moins cher (ecart %.4f EUR/tx)"%(etiq,eco_sepa))
        else:
            print("    %-16s vs Stripe SEPA  : %6.0f abonnes pour rentrer en 24 mois"%(etiq,(surcout/24+BNP_ABO)/eco_sepa))

print("\n"+"="*78)
print("L OPTION QUE LE CALCUL FAIT APPARAITRE")
print("="*78)
b1=bnp_tx(MIX["H1 cartes perso"])+BNP_TX
b2=bnp_tx(MIX["H2 realiste B2B"])+BNP_TX
ss=stripe_sepa_tx(billing=False)
print("  Si on ecrit le moteur d abonnement soi-meme (obligatoire avec BNP),")
print("  on peut aussi l ecrire sur Stripe et ne PAS payer Billing :")
print("    BNP H1 cartes perso            %.4f EUR/tx" % b1)
print("    Stripe SEPA sans Billing       %.4f EUR/tx" % ss)
print("    BNP H2 realiste B2B            %.4f EUR/tx" % b2)
print("  => a mix B2B realiste, Stripe SEPA est %.4f EUR MOINS cher que BNP," % (b2-ss))
print("     soit %.0f EUR/an pour 1 000 abonnes, sans les 18 EUR/mois ni le risque." % ((b2-ss)*1000*12))

print("\n"+"="*78)
print("PROJECTION 5 ANS (abonnes moyens sur l annee)")
print("="*78)
CROISSANCE=[("Annee 1",150),("Annee 2",500),("Annee 3",1200),("Annee 4",2500),("Annee 5",4000)]
DEV_BNP=20*TJM   # moteur d abonnement a ecrire
cum={"BNP H2":DEV_BNP,"Stripe carte+Billing":0.0,"Stripe SEPA+Billing":0.0,"Stripe SEPA seul":DEV_BNP}
print("%-9s %7s %11s | %11s %11s %11s %11s"%("","abon.","CA/an","BNP H2","Stripe c+B","Stripe SEPA+B","Stripe SEPA"))
for an,n in CROISSANCE:
    ca=n*PRIX*12
    a=bnp_mois(n,MIX["H2 realiste B2B"])*12
    b=n*stripe_carte_tx(0.40)*12
    c=n*stripe_sepa_tx()*12
    d=n*ss*12
    cum["BNP H2"]+=a; cum["Stripe carte+Billing"]+=b
    cum["Stripe SEPA+Billing"]+=c; cum["Stripe SEPA seul"]+=d
    print("%-9s %7d %10.0f€ | %10.0f€ %10.0f€ %10.0f€ %10.0f€"%(an,n,ca,a,b,c,d))
print("\n  CUMUL 5 ANS (developpement du moteur inclus : %.0f EUR quand il est necessaire)"%DEV_BNP)
for k,v in sorted(cum.items(), key=lambda x:x[1]):
    print("    %-24s %9.0f EUR"%(k,v))
ecart=cum["Stripe carte+Billing"]-cum["BNP H2"]
print("\n  Ecart BNP vs Stripe carte+Billing sur 5 ans : %.0f EUR en faveur de BNP"%ecart)
print("  Ecart BNP vs Stripe SEPA seul sur 5 ans     : %.0f EUR en faveur de %s"%(
  abs(cum["BNP H2"]-cum["Stripe SEPA seul"]), "Stripe" if cum["Stripe SEPA seul"]<cum["BNP H2"] else "BNP"))
