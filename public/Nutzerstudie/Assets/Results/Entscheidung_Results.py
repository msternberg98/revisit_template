"""Quantitative Auswertung der Regionsentscheidung mit Diagrammen.
Neben Nutzerstudie_all_tidy.csv ablegen. Ausgabe: Analysis_Output/Entscheidung.
Benötigt: pandas, numpy, scipy, openpyxl
"""
from pathlib import Path
import re
import numpy as np
import pandas as pd
from scipy import stats
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from openpyxl.styles import Font, Alignment, PatternFill
from openpyxl.utils import get_column_letter

CSV_FILENAME = 'Nutzerstudie_all_tidy.csv'
OUTPUT_FOLDER = Path('Analysis_Output') / 'Entscheidung'
INCLUDE_INCOMPLETE = False
METHODS = ['VSUP', 'ScaledGlyph', 'IsoGlyph']
TARGET_C = -12.0
# (Mittelwert °C, mittlere Unsicherheit; Unsicherheitseinheit anhand der Studiendaten prüfen)
REGIONS = {
 'IsoGlyph': [(-13.1901063,5.4355829),(-0.94865091016,3.129501516),(0.583982728,1.5260805704),(-3.604896392,1.424277884),(2.78459602,0.6421452136)],
 'ScaledGlyph': [(-13.324312746,5.06290306),(-0.9009721432,3.080212368),(0.619351364,1.5227066124),(-19.99693754,1.455844682),(2.77247876,0.650520978)],
 'VSUP': [(-13.1901063,5.4355829),(-1.23907347408,3.135608284),(0.4606507216,1.4988802804),(-20.09617172,1.429650956),(2.704020264,0.6453833008)]
}

def describe(x):
 s=pd.to_numeric(pd.Series(x),errors='coerce').dropna()
 return {'n':len(s),'Mittelwert':s.mean(),'Median':s.median(),'Standardabweichung':s.std(ddof=1),
         'Q1':s.quantile(.25),'Q3':s.quantile(.75)}

def friedman(wide, label):
 w=wide.reindex(columns=METHODS).dropna()
 if len(w)<3 or (w.nunique(axis=1)==1).all():
  return [{'Vergleich':label,'Test':'Friedman','n':len(w),'Hinweis':'Nicht berechenbar: zu wenige Paare oder keine Unterschiede'}]
 stat,p=stats.friedmanchisquare(*(w[m] for m in METHODS))
 result=[{'Vergleich':label,'Test':'Friedman','n':len(w),'Statistik':stat,'p':p,'Kendall_W':stat/(len(w)*2),
          'p_Holm':np.nan,'Ergebnis':'Signifikant' if p<.05 else 'Nicht signifikant','Hinweis':'Gepaarte Daten'}]
 if p<.05:
  pairs=[('VSUP','ScaledGlyph'),('VSUP','IsoGlyph'),('ScaledGlyph','IsoGlyph')]
  raw=[]
  for a,b in pairs:
   diff=w[a]-w[b]
   if np.allclose(diff,0): raw.append((a,b,0.,1.))
   else:
    try: s,pp=stats.wilcoxon(w[a],w[b],zero_method='wilcox',alternative='two-sided');raw.append((a,b,s,pp))
    except ValueError:raw.append((a,b,np.nan,np.nan))
  order=sorted(range(3),key=lambda i:raw[i][3]);adj=[np.nan]*3;prev=0
  for j,i in enumerate(order):
   prev=max(prev,min(1.,raw[i][3]*(3-j)));adj[i]=prev
  for (a,b,s,pp),ap in zip(raw,adj):
   result.append({'Vergleich':label,'Test':f'Wilcoxon: {a} / {b}','n':len(w),'Statistik':s,
                  'p':pp,'p_Holm':ap,'Ergebnis':'Signifikant' if ap<.05 else 'Nicht signifikant',
                  'Hinweis':'Holm-korrigierter paarweiser Vergleich'})
 return result

def main():
 folder=Path(__file__).resolve().parent
 raw=pd.read_csv(folder/CSV_FILENAME,low_memory=False,dtype={'participantId':str})
 required={'participantId','trialId','responseId','answer','status','percentComplete'}
 if missing:=required-set(raw.columns):raise ValueError(f'Fehlende CSV-Spalten: {missing}')
 if not INCLUDE_INCOMPLETE:
  pc=pd.to_numeric(raw.percentComplete,errors='coerce')
  info=raw.assign(_pc=pc).groupby('participantId').agg(max_pc=('_pc','max'),
       completed=('status',lambda s:s.eq('completed').any()),
       progress=('status',lambda s:s.eq('in progress').any()),
       rejected=('status',lambda s:s.eq('rejected').any()))
  keep=info.index[~info.rejected & info.completed]
  raw=raw[raw.participantId.isin(keep)].copy()
 region_rows=[]
 for method,values in REGIONS.items():
  for i,(mean,unc) in enumerate(values,1):
   region_rows.append({'Methode':method,'Region':f'R{i}','Temperatur_C':mean,
    'Temperaturabweichung_C':abs(mean-TARGET_C),'Unsicherheit':unc})
 region_df=pd.DataFrame(region_rows)
 min_unc=region_df.loc[region_df.groupby('Methode').Unsicherheit.idxmin(),['Methode','Region']].set_index('Methode').Region.to_dict()
 min_dev=region_df.loc[region_df.groupby('Methode').Temperaturabweichung_C.idxmin(),['Methode','Region']].set_index('Methode').Region.to_dict()
 selected=raw[raw.trialId.astype(str).str.fullmatch(r'Temperatur_Regions_(VSUP|ScaledGlyph|IsoGlyph)')].copy()
 selected=selected[selected.responseId.astype(str).str.contains(r'_(?:Radio|LongText|Likert)_Response$',regex=True)].copy()
 selected['Methode']=selected.trialId.str.replace('Temperatur_Regions_','',regex=False)
 selected['Typ']=selected.responseId.str.extract(r'_(Radio|LongText|Likert)_Response$')[0]
 duplicates=selected.duplicated(['participantId','Methode','Typ'],keep=False)
 if duplicates.any():raise ValueError('Doppelte Entscheidungsantworten: '+str(selected.loc[duplicates,['participantId','Methode','Typ']].to_dict('records')[:5]))
 answers=selected.pivot(index=['participantId','Methode'],columns='Typ',values='answer').reset_index()
 answers=answers.rename(columns={'participantId':'Teilnehmer','Radio':'Region','LongText':'Begründung','Likert':'Likert_Sicherheit'})
 for col in ['Region','Begründung','Likert_Sicherheit']:
  if col not in answers:answers[col]=np.nan
 answers['Region']=answers.Region.astype('string').str.strip().str.upper()
 answers.loc[~answers.Region.isin(['R1','R2','R3','R4','R5']),'Region']=pd.NA
 answers['Likert_Sicherheit']=pd.to_numeric(answers.Likert_Sicherheit,errors='coerce')
 # Dauer pro Aufgabenblock nur einmal erfassen, da sie bei Radio/Text/Likert wiederholt wird.
 duration_col='cleanedDuration' if 'cleanedDuration' in selected.columns else 'duration'
 durations=selected.groupby(['participantId','Methode'])[duration_col].first().reset_index().rename(columns={'participantId':'Teilnehmer'})
 durations['Zeit_s']=pd.to_numeric(durations[duration_col],errors='coerce')/1000
 answers=answers.merge(durations[['Teilnehmer','Methode','Zeit_s']],on=['Teilnehmer','Methode'],how='left')
 answers=answers.merge(region_df,on=['Methode','Region'],how='left')
 answers['Sicherste_Region']=answers.apply(lambda r:r.Region==min_unc[r.Methode] if pd.notna(r.Region) else pd.NA,axis=1)
 answers['Temperatur_nächste_Region']=answers.apply(lambda r:r.Region==min_dev[r.Methode] if pd.notna(r.Region) else pd.NA,axis=1)
 answers['Begründung']=answers.Begründung.replace(r'^\s*$',np.nan,regex=True)
 answers['Wortanzahl']=answers['Begründung'].map(lambda v: len(str(v).split()) if pd.notna(v) else np.nan)
 answers=answers.sort_values(['Teilnehmer','Methode'])
 choices=[]
 for method in METHODS:
  subset=answers[(answers.Methode==method)&answers.Region.notna()]
  for region in ['R1','R2','R3','R4','R5']:
   n=int((subset.Region==region).sum())
   choices.append({'Methode':method,'Region':region,'n_gewählt':n,'n_gültige_Wahlen':len(subset),
                   'Anteil_%':100*n/len(subset) if len(subset) else np.nan})
 choice_df=pd.DataFrame(choices)
 methods=[]
 for method in METHODS:
  sub=answers[(answers.Methode==method)&answers.Region.notna()]
  methods.append({'Methode':method,'n_gültige_Wahlen':len(sub),
   'Unsicherheit_Mittelwert':sub.Unsicherheit.mean(),
   'Unsicherheit_Median':sub.Unsicherheit.median(),
   'Temperaturabweichung_C_Mittelwert':sub.Temperaturabweichung_C.mean(),
   'Temperaturabweichung_C_Median':sub.Temperaturabweichung_C.median(),
   'n_sicherste_Region':sub.Sicherste_Region.sum(),
   'Anteil_sicherste_Region_%':100*sub.Sicherste_Region.mean() if len(sub) else np.nan,
   'n_temperaturnächste_Region':sub['Temperatur_nächste_Region'].sum(),
   'Anteil_temperaturnächste_Region_%':100*sub['Temperatur_nächste_Region'].mean() if len(sub) else np.nan})
 methods_df=pd.DataFrame(methods)
 likert=pd.DataFrame([{'Methode':m,**describe(answers.loc[answers.Methode==m,'Likert_Sicherheit'])} for m in METHODS])
 likert_dist=pd.DataFrame([{'Methode':m,'Antwort':val,'Anzahl':int(((answers.Methode==m)&(answers.Likert_Sicherheit==val)).sum())}
  for m in METHODS for val in sorted(answers.Likert_Sicherheit.dropna().unique())])
 # Deskriptive Bearbeitungszeiten pro Visualisierungsmethode.
 time_desc=pd.DataFrame([{'Methode':m,**describe(answers.loc[answers.Methode==m,'Zeit_s'])}
                         for m in METHODS])
 # Individuelle Regionswahlen und paarweise Übereinstimmung.
 region_wide=answers.pivot(index='Teilnehmer',columns='Methode',values='Region').reindex(columns=METHODS)
 individual=region_wide.reset_index().copy()
 for a,b in [('VSUP','ScaledGlyph'),('VSUP','IsoGlyph'),('ScaledGlyph','IsoGlyph')]:
  individual[f'Gleich_{a}_{b}']=region_wide.apply(
   lambda r: bool(r[a]==r[b]) if pd.notna(r[a]) and pd.notna(r[b]) else pd.NA,axis=1).values
 individual['Anzahl_unterschiedlicher_Regionen']=region_wide.nunique(axis=1).values
 individual.loc[region_wide.isna().any(axis=1).values,'Anzahl_unterschiedlicher_Regionen']=np.nan
 agreement=[]
 for a,b in [('VSUP','ScaledGlyph'),('VSUP','IsoGlyph'),('ScaledGlyph','IsoGlyph')]:
  pair=region_wide[[a,b]].dropna()
  count=int(pair[a].eq(pair[b]).sum())
  agreement.append({'Vergleich':f'{a} / {b}','n_vollständige_Paare':len(pair),
                    'n_übereinstimmend':count,'Anteil_übereinstimmend_%':100*count/len(pair) if len(pair) else np.nan})
 agreement_df=pd.DataFrame(agreement)
 pattern_counts=(individual['Anzahl_unterschiedlicher_Regionen'].value_counts().reindex([1,2,3],fill_value=0))
 patterns=pd.DataFrame({'Anzahl_unterschiedlicher_Regionen':[1,2,3],
                        'n_Teilnehmende':[int(pattern_counts.loc[i]) for i in [1,2,3]]})
 # Explorative, gepoolte Spearman-Rangkorrelationen: 45 Entscheidungen stammen
 # von 15 Personen; wegen Messwiederholungen keine unabhängigen Beobachtungen.
 correlations=[]
 for a,b in [('Wortanzahl','Zeit_s'),('Wortanzahl','Likert_Sicherheit'),
             ('Zeit_s','Likert_Sicherheit')]:
  pair=answers[[a,b]].apply(pd.to_numeric,errors='coerce').dropna()
  if len(pair)>=3 and pair[a].nunique()>1 and pair[b].nunique()>1:
   rho=float(stats.spearmanr(pair[a],pair[b]).statistic)
  else:rho=np.nan
  correlations.append({'Variable_1':a,'Variable_2':b,'n_Entscheidungen':len(pair),
                       'Spearman_rho':rho,'Hinweis':'Explorativ; Beobachtungen derselben Personen nicht unabhängig; kein p-Test'})
 corr_df=pd.DataFrame(correlations)
 tests=[]
 for col,label in [('Unsicherheit','Gewählte Unsicherheit'),('Temperaturabweichung_C','Abweichung von -12 °C'),
                   ('Likert_Sicherheit','Subjektive Entscheidungssicherheit'),('Zeit_s','Bearbeitungszeit')]:
  w=answers.pivot(index='Teilnehmer',columns='Methode',values=col)
  tests.extend(friedman(w,label))
 # Keine inferenzstatistische Auswertung binärer Erst-/Bestwahl ohne gesonderten Testplan.
 notes=pd.DataFrame({'Hinweise':[
  'Deskriptive Daten verwenden alle jeweils vorhandenen gültigen Antworten.',
  'Friedman-Tests verwenden je Zielgröße nur vollständige Personen mit Antworten für alle drei Methoden.',
  'Temperaturabweichung ist der absolute Abstand vom Zielwert -12 °C.',
  'R1 ist jeweils dem Zielwert am nächsten, R5 weist jeweils die geringste Unsicherheit auf.',
  'Es gibt keine objektiv beste Region ohne festgelegte Gewichtung zwischen Temperatur und Unsicherheit.',
  'Die Temperaturen der Region R4 unterscheiden sich zwischen IsoGlyph und den anderen Methoden im Vorzeichen der Abweichung.',
  'Likert-Mittelwerte sind ergänzend deskriptiv; ordinale Antworten zusätzlich über Median und Verteilung beurteilen.',
  'Schriftliche Begründungen bleiben unverändert; qualitative Kategorien werden weiterhin manuell ausgewertet.',
  'Die Einheit der Unsicherheit ist vor der Veröffentlichung anhand der Studiendefinition zu verifizieren.',
  'Prüfen, ob Probedurchläufe im CSV enthalten sind; sie werden nicht automatisch erkannt.',
 ]})
 # Regionswahl: Einzelwahlen, paarweise Übereinstimmungen und Muster in einem Blatt.
 # Die drei separaten CSV-Dateien bleiben für bestehende Auswertungen erhalten.
 tables=[('Einzelentscheidungen',answers),('Regionswerte',region_df),('Auswahlhäufigkeiten',choice_df),
         ('Methodenvergleich',methods_df),('Likert_Auswertung',likert),('Likert_Verteilung',likert_dist),
         ('Statistische_Tests',pd.DataFrame(tests)),('Bearbeitungszeit_Deskriptiv',time_desc),
         ('Spearman_Korrelationen',corr_df)]
 out=folder/OUTPUT_FOLDER;out.mkdir(parents=True,exist_ok=True)
 def excel_value(v):
  if pd.isna(v):return None
  if isinstance(v,np.generic):return v.item()
  return v
 def write_section(ws,heading,table,description,row):
  ncols=max(2,len(table.columns))
  for j in range(1,ncols+1):ws.cell(row,j).fill=PatternFill('solid',fgColor='3676B6')
  ws.merge_cells(start_row=row,start_column=1,end_row=row,end_column=ncols)
  cell=ws.cell(row,1,heading);cell.font=Font(bold=True,color='FFFFFF',size=11)
  cell.alignment=Alignment(vertical='center',wrap_text=True)
  ws.row_dimensions[row].height=29;row+=1
  if description:
   for j in range(1,ncols+1):ws.cell(row,j).fill=PatternFill('solid',fgColor='EAF0F6')
   ws.merge_cells(start_row=row,start_column=1,end_row=row,end_column=ncols)
   cell=ws.cell(row,1,description);cell.font=Font(color='20354A')
   cell.alignment=Alignment(vertical='center',wrap_text=True)
   ws.row_dimensions[row].height=44 if len(description)>110 else 31
   row+=1
  for j,name in enumerate(table.columns,1):
   cell=ws.cell(row,j,str(name));cell.font=Font(bold=True,color='20354A')
   cell.fill=PatternFill('solid',fgColor='D7E5F1')
   cell.alignment=Alignment(vertical='center',wrap_text=True)
  ws.row_dimensions[row].height=max(32,min(120,16*max(1,max((len(str(name))//max(10,int(ws.column_dimensions[get_column_letter(j)].width)-3)+1) for j,name in enumerate(table.columns,1)))+8));row+=1
  for values in table.itertuples(index=False,name=None):
   for j,value in enumerate(values,1):
    value=excel_value(value)
    cell=ws.cell(row,j,value)
    cell.alignment=Alignment(vertical='center',horizontal='center' if isinstance(value,(int,float)) and not isinstance(value,bool) else 'left',wrap_text=True)
    if isinstance(value,float):cell.number_format='#,##0.0000;[Red]-#,##0.0000'
    if isinstance(value,int):cell.number_format='0'
   # Excel passt Zeilenhöhen bei umbrochenem Text nicht zuverlässig selbst an.
   line_counts=[]
   for j,value in enumerate(values,1):
    if value is None:continue
    width=max(8,int(ws.column_dimensions[get_column_letter(j)].width)-4)
    line_counts.append(sum(max(1,(len(line)+width-1)//width) for line in str(value).split('\n')))
   ws.row_dimensions[row].height=max(23,min(420,16*max(line_counts,default=1)+7))
   row+=1
  return row+2
 def make_sheet(wb,name,sections,note):
  ws=wb.create_sheet(name)
  ws.sheet_view.showGridLines=False
  ncols=max([2]+[len(t.columns) for _,t,_ in sections])
  widths=[21.0]*ncols
  for _,table,_ in sections:
   for j,col in enumerate(table.columns):
    samples=[str(col)]+[str(v) for v in table.iloc[:100,j] if pd.notna(v)]
    longest=max((len(x) for x in samples),default=12)
    widths[j]=max(widths[j],min(48.,longest+3))
  # Textspalten kompakt halten und über die Zeilenhöhe vollständig darstellen.
  if name == '00_Lesehilfe':
   widths[0]=max(widths[0],32.)
   widths[1]=max(widths[1],85.)
  for j,w in enumerate(widths,1):ws.column_dimensions[get_column_letter(j)].width=w
  for j in range(1,ncols+1):ws.cell(1,j).fill=PatternFill('solid',fgColor='23415C')
  ws.merge_cells(start_row=1,start_column=1,end_row=1,end_column=ncols)
  top=ws.cell(1,1,note);top.font=Font(color='FFFFFF',bold=True,size=11)
  top.alignment=Alignment(wrap_text=True,vertical='center');ws.row_dimensions[1].height=40
  row=3
  for heading,table,description in sections:row=write_section(ws,heading,table,description,row)
  return ws
 with pd.ExcelWriter(out/'00_Entscheidungsaufgabe_Auswertung.xlsx',engine='openpyxl') as writer:
  wb=writer.book
  guide=pd.DataFrame([
   ('Datenbasis','Nur abgeschlossene und nicht abgelehnte Teilnahmen; deskriptiv alle jeweils gültigen Werte.'),
   ('Einzelentscheidungen','Regionswahl, regionale Temperatur und Unsicherheit, Begründung, Likert-Sicherheit, bereinigte Zeit und Wortanzahl.'),
   ('Bearbeitungszeit','cleanedDuration in Millisekunden / 1000; umfasst Regionswahl, Begründung und Sicherheitseinschätzung; Tabwechselzeiten sind bereinigt.'),
   ('Mittelwert und Median','Arithmetischer Mittelwert bzw. 50. Perzentil; keine Entfernung von Ausreißern.'),
   ('Standardabweichung','Stichprobenstandardabweichung mit ddof=1.'),
   ('Friedman-Test','Vergleich der drei Methoden innerhalb derselben Person; nur vollständige Methodentripel.'),
   ('Kendall W','Friedman-Chi-Quadrat geteilt durch n × (3 − 1).'),
   ('Wilcoxon','Paarweise Folgetests nur nach signifikantem Friedman-Test; Holm-Korrektur der drei Paarvergleiche.'),
   ('Regionswahl-Übereinstimmung','Gleiche Regionsnummer bei zwei Methoden; individuelle Wahlen, Paarvergleiche und Muster gemeinsam dargestellt.'),
   ('Spearman','Rangkorrelation der Wortanzahl, Bearbeitungszeit und subjektiven Sicherheit; explorativ über alle Entscheidungen, keine p-Tests wegen wiederholter Messungen.'),
   ('Wortanzahl','Anzahl durch Leerzeichen getrennter Wörter der schriftlichen Begründung.'),
   ('Qualitative Kategorien','Werden manuell außerhalb dieses Skripts ausgewertet.')
  ],columns=['Begriff','Berechnung / Bedeutung'])
  make_sheet(wb,'00_Lesehilfe',[('Berechnungsgrundlagen',guide,'')],'Hinweise zur Auswertung der Entscheidungsaufgaben')
  section_info={
   'Einzelentscheidungen':('A. Einzelentscheidungen','Je Person und Methode: Auswahl, Kennwerte, Begründung, Zeit und Sicherheit.'),
   'Regionswerte':('A. Regionale Kennwerte','Mittelwerte der 25 Zellen je Region; Temperaturabweichung zum Zielwert −12 °C.'),
   'Auswahlhäufigkeiten':('A. Häufigkeiten der Regionswahlen','Absolute Häufigkeiten und relative Anteile pro Methode und Region.'),
   'Methodenvergleich':('A. Deskriptiver Methodenvergleich','Kennzahlen der jeweils ausgewählten Regionen.'),
   'Likert_Auswertung':('A. Subjektive Entscheidungssicherheit','Skala 1 bis 7; deskriptive Kennzahlen pro Methode.'),
   'Likert_Verteilung':('A. Likert-Antwortverteilung','Absolute Häufigkeit je Antwortstufe und Methode.'),
   'Statistische_Tests':('A. Friedman-Tests und gegebenenfalls Wilcoxon-Folgetests','Gepaarte Methodenvergleiche für Unsicherheit, Temperaturabweichung, Sicherheit und Zeit.'),
   'Bearbeitungszeit_Deskriptiv':('A. Bearbeitungszeiten pro Methode','Bereinigte Dauer des gesamten Entscheidungsblocks in Sekunden.'),
   'Spearman_Korrelationen':('A. Explorative Spearman-Korrelationen','Alle Entscheidungen gemeinsam; wiederholte Messungen pro Person, deshalb keine inferenzstatistischen p-Werte.')}
  for name,table in tables:
   heading,description=section_info[name]
   make_sheet(wb,name,[(heading,table,description)],f'Entscheidungsaufgaben | {name.replace("_"," ")}')
  make_sheet(wb,'Regionswahl_Vergleich',[
   ('A. Individuelle Regionswahlen',individual,'Gleiche Regionsnummer bei zwei Methoden = Übereinstimmung; fehlende Wahlen werden nicht als Übereinstimmung gewertet.'),
   ('B. Paarweise Übereinstimmung',agreement_df,'Je Methodenpaar: Anzahl vollständiger Paare, identische Wahlen und prozentualer Anteil.'),
   ('C. Muster der Regionswahlen',patterns,'Anzahl verschiedener gewählter Regionen je Person über alle drei Methoden; nur vollständige Wahlen.')
  ],'Vergleich der Regionswahlen | Individuell, paarweise und zusammengefasst')
  # CSV-Ausgaben bleiben rückwärtskompatibel; keine bisherigen Dateien löschen.
  for name,table in tables+[('Individuelle_Regionswahl',individual),
                            ('Regionswahl_Uebereinstimmung',agreement_df),('Regionswahl_Muster',patterns)]:
   table.to_csv(out/f'{name}.csv',sep=';',decimal=',',index=False,encoding='utf-8-sig')
  notes.to_csv(out/'Lesehilfe.csv',sep=';',decimal=',',index=False,encoding='utf-8-sig')
 # Regionswahl: drei eigenständige Grafiken mit identischer Skalierung.
 palette={'VSUP':'#3676b6','ScaledGlyph':'#e5a343','IsoGlyph':'#779b7b'}
 max_count=int(choice_df['n_gewählt'].max()) if len(choice_df) else 0
 upper=max(1,max_count+1)
 for method in METHODS:
  d=choice_df[choice_df.Methode==method].set_index('Region').reindex([f'R{i}' for i in range(1,6)])
  fig,ax=plt.subplots(figsize=(7,4.5))
  bars=ax.bar(d.index,d.n_gewählt.fillna(0),color=palette[method],width=.65)
  ax.bar_label(bars,padding=3,fmt='%d')
  ax.set_ylabel('Anzahl der Entscheidungen')
  ax.set_xlabel('Gewählte Region')
  ax.set_ylim(0,upper)
  ax.yaxis.get_major_locator().set_params(integer=True)
  ax.spines[['top','right']].set_visible(False)
  fig.tight_layout()
  fig.savefig(out/f'01_Regionswahl_{method}.png',dpi=300,bbox_inches='tight')
  fig.savefig(out/f'01_Regionswahl_{method}.pdf',bbox_inches='tight')
  plt.close(fig)
 # Likert-Verteilung: gestapelte absolute Häufigkeiten; alle Methoden mit gleicher Skala.
 levels=sorted(answers.Likert_Sicherheit.dropna().unique())
 if levels:
  fig,ax=plt.subplots(figsize=(8,4.7))
  bottoms=np.zeros(len(METHODS))
  cmap=plt.get_cmap('viridis',len(levels))
  for i,level in enumerate(levels):
   counts=np.array([int(((answers.Methode==m)&(answers.Likert_Sicherheit==level)).sum()) for m in METHODS])
   bars=ax.bar([{'VSUP':'VSUP','ScaledGlyph':'Scaled Glyph','IsoGlyph':'IsoGlyph'}[m] for m in METHODS],counts,bottom=bottoms,label=f'{level:g}',color=cmap(i))
   for rect,n in zip(bars,counts):
    if n:ax.text(rect.get_x()+rect.get_width()/2,rect.get_y()+rect.get_height()/2,str(n),ha='center',va='center',fontsize=9,color='white')
   bottoms+=counts
  ax.set_ylabel('Anzahl der Antworten')
  ax.set_ylim(0,max(1,int(max(bottoms))+1))
  ax.yaxis.get_major_locator().set_params(integer=True)
  ax.legend(title='Likert-Antwort',bbox_to_anchor=(1.02,.5),loc='center left')
  ax.spines[['top','right']].set_visible(False)
  fig.tight_layout()
  fig.savefig(out/'02_Likert_Verteilung.png',dpi=300,bbox_inches='tight')
  fig.savefig(out/'02_Likert_Verteilung.pdf',bbox_inches='tight')
  plt.close(fig)
 # Ergänzende Likert-Grafik: nebeneinanderstehende Säulen für jede Antwortstufe.
 if levels:
  fig,ax=plt.subplots(figsize=(9,4.7))
  x=np.arange(len(levels))
  width=.24
  for i,method in enumerate(METHODS):
   counts=[int(((answers.Methode==method)&(answers.Likert_Sicherheit==level)).sum()) for level in levels]
   bars=ax.bar(x+(i-1)*width,counts,width,color=palette[method],
               label={'VSUP':'VSUP','ScaledGlyph':'Scaled Glyph','IsoGlyph':'IsoGlyph'}[method])
   ax.bar_label(bars,padding=3,fmt='%d',fontsize=9)
  ax.set_xticks(x,[f'{level:g}' for level in levels])
  ax.set_xlabel('Likert-Antwort')
  ax.set_ylabel('Anzahl der Antworten')
  ax.set_ylim(0,max(1,int(likert_dist.Anzahl.max())+1))
  ax.yaxis.get_major_locator().set_params(integer=True)
  ax.legend(bbox_to_anchor=(1.02,.5),loc='center left')
  ax.spines[['top','right']].set_visible(False)
  fig.tight_layout()
  fig.savefig(out/'03_Likert_Nebeneinander.png',dpi=300,bbox_inches='tight')
  fig.savefig(out/'03_Likert_Nebeneinander.pdf',bbox_inches='tight')
  plt.close(fig)
 # Boxplot Bearbeitungszeit, analog zu Identifikation_Results.py.
 fig,ax=plt.subplots(figsize=(7.5,5.2))
 labels={'VSUP':'VSUP','ScaledGlyph':'Scaled Glyph','IsoGlyph':'IsoGlyph'}
 counts={}
 for i,method in enumerate(METHODS,1):
  values=answers.loc[answers.Methode.eq(method),'Zeit_s'].dropna().to_numpy(dtype=float)
  counts[method]=len(values)
  if not len(values):continue
  bp=ax.boxplot([values],positions=[i],widths=.52,patch_artist=True,
                whis=1.5,showmeans=False,showfliers=True,
                flierprops={'marker':'o','markerfacecolor':palette[method],
                            'markeredgecolor':'white','markersize':5,'alpha':.85})
  bp['boxes'][0].set(facecolor=palette[method],alpha=.3,edgecolor=palette[method])
  for item in bp['medians']:
   item.set(color=palette[method],linewidth=2)
 if len(set(counts.values()))==1:
  n_label=f'n = {next(iter(counts.values()))}'
 else:
  n_label='n: '+', '.join(f'{labels[m]} {counts[m]}' for m in METHODS)
 ax.text(0.0,-0.17,n_label,transform=ax.transAxes,ha='left',va='top',
         fontsize=7.5,color='#555555',clip_on=False)
 ax.set_xticks(range(1,4),[labels[m] for m in METHODS])
 ax.set_ylabel('Bearbeitungszeit (s)')
 ax.set_title('Entscheidungsaufgaben')
 ax.spines[['top','right']].set_visible(False)
 fig.tight_layout()
 fig.savefig(out/'04_Entscheidung_Bearbeitungszeit.png',dpi=300,bbox_inches='tight')
 fig.savefig(out/'04_Entscheidung_Bearbeitungszeit.pdf',bbox_inches='tight')
 plt.close(fig)
 print('Teilnehmende:',raw.participantId.nunique(),'Entscheidungen:',len(answers))
 print('Gültige Wahlen:',answers.groupby('Methode').Region.count().to_dict())
 print('Ausgabe:',out)

if __name__=='__main__':main()
