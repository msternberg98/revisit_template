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
from openpyxl.styles import Font, Alignment

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
  keep=info.index[~info.rejected & (info.completed | (info.progress & info.max_pc.ge(100)))]
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
  'Schriftliche Begründungen sind unverändert in Einzelentscheidungen enthalten; eine qualitative Bewertung erfolgt außerhalb dieses Skripts.',
  'Die Einheit der Unsicherheit ist vor der Veröffentlichung anhand der Studiendefinition zu verifizieren.',
  'Prüfen, ob Probedurchläufe im CSV enthalten sind; sie werden nicht automatisch erkannt.',
 ]})
 tables=[('Einzelentscheidungen',answers),('Regionswerte',region_df),('Auswahlhäufigkeiten',choice_df),
         ('Methodenvergleich',methods_df),('Likert_Auswertung',likert),('Likert_Verteilung',likert_dist),
         ('Statistische_Tests',pd.DataFrame(tests)),('Lesehilfe',notes)]
 out=folder/OUTPUT_FOLDER;out.mkdir(parents=True,exist_ok=True)
 with pd.ExcelWriter(out/'00_Entscheidungsaufgabe_Auswertung.xlsx',engine='openpyxl') as writer:
  for name,table in tables:
   table.to_excel(writer,sheet_name=name,index=False)
   ws=writer.sheets[name];ws.auto_filter.ref=ws.dimensions
   ws.freeze_panes='C2' if name == 'Einzelentscheidungen' else None
   for cell in ws[1]:cell.font=Font(bold=True)
   for col in ws.columns:
    ws.column_dimensions[col[0].column_letter].width=min(55,max(14,max(len(str(c.value or '')) for c in list(col)[:100])+2))
  for name,table in tables:
   table.to_csv(out/f'{name}.csv',sep=';',decimal=',',index=False,encoding='utf-8-sig')
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
 print('Teilnehmende:',raw.participantId.nunique(),'Entscheidungen:',len(answers))
 print('Gültige Wahlen:',answers.groupby('Methode').Region.count().to_dict())
 print('Ausgabe:',out)

if __name__=='__main__':main()
