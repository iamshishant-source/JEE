package com.jeepilot.app;

import android.app.*;
import android.os.*;
import android.content.*;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.*;
import android.widget.*;
import java.util.*;

public class MainActivity extends Activity {
    private static final int BLUE = Color.rgb(108,158,255), BG = Color.rgb(11,16,32), CARD = Color.rgb(18,26,45);
    private LinearLayout root, content; private TextView readiness, minutes, streak; private CountDownTimer timer; private int seconds = 1500;
    private final String[] subjects = {"Physics", "Chemistry", "Maths"};
    private final String[][] topics = {{"Kinematics", "NLM & friction", "Electrostatics", "Modern physics"}, {"Mole concept", "Chemical bonding", "Organic basics", "Coordination compounds"}, {"Quadratic equations", "Limits & continuity", "Vectors & 3D", "Probability"}};
    private final int[][] scores = {{35,25,52,68},{42,31,48,60},{55,28,45,22}};
    private SharedPreferences store;

    @Override public void onCreate(Bundle b) { super.onCreate(b); store = getSharedPreferences("progress", 0); loadScores(); build(); }
    private TextView text(String value, float size, int color) { TextView v = new TextView(this); v.setText(value); v.setTextSize(size); v.setTextColor(color); v.setPadding(0,4,0,4); return v; }
    private Button button(String label) { Button b = new Button(this); b.setText(label); b.setTextColor(Color.WHITE); b.setTextSize(12); b.setAllCaps(false); return b; }
    private LinearLayout card() { LinearLayout l = new LinearLayout(this); l.setOrientation(LinearLayout.VERTICAL); l.setPadding(22,18,22,18); l.setBackgroundColor(CARD); LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1,-2); p.setMargins(0,0,0,14); l.setLayoutParams(p); return l; }
    private void build() {
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(22,18,22,10); root.setBackgroundColor(BG);
        LinearLayout header = new LinearLayout(this); header.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = text("JEE Pilot",22,Color.WHITE); title.setTypeface(Typeface.DEFAULT,Typeface.BOLD); header.addView(title,new LinearLayout.LayoutParams(0,-2,1));
        streak = text("🔥 "+store.getInt("streak",0)+" days",12,Color.rgb(255,173,103)); header.addView(streak); root.addView(header);
        ScrollView scroll = new ScrollView(this); content = new LinearLayout(this); content.setOrientation(LinearLayout.VERTICAL); content.setPadding(0,22,0,0); scroll.addView(content); root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1)); setContentView(root); renderHome();
    }
    private void renderHome() {
        content.removeAllViews(); TextView welcome=text("Make today count.",34,Color.WHITE); welcome.setTypeface(Typeface.DEFAULT,Typeface.BOLD); content.addView(welcome);
        content.addView(text("A safe accountability system for consistent JEE progress.",14,Color.LTGRAY));
        LinearLayout stats=card(); readiness=text("0%",28,Color.WHITE); minutes=text("0 min",28,Color.WHITE); LinearLayout row=new LinearLayout(this);
        row.addView(stat("READINESS",readiness),new LinearLayout.LayoutParams(0,-2,1)); row.addView(stat("FOCUS LOGGED",minutes),new LinearLayout.LayoutParams(0,-2,1)); stats.addView(row); content.addView(stats); updateStats();
        TextView mission=text("TODAY'S MISSION",11,BLUE); mission.setPadding(0,15,0,7); content.addView(mission);
        int[] weak=weakest(); content.addView(taskCard("Repair the gap",subjects[weak[0]]+" · "+topics[weak[0]][weak[1]],"50 min · solve 10 questions without notes"));
        int[] second=secondWeakest(); content.addView(taskCard("Build fluency",subjects[second[0]]+" · "+topics[second[0]][second[1]],"40 min · examples then timed practice"));
        TextView map=text("KNOWLEDGE MAP",11,BLUE); map.setPadding(0,10,0,7); content.addView(map); LinearLayout mastery=card();
        for(int s=0;s<3;s++) for(int t=0;t<4;t++){ final int fs=s,ft=t; TextView topic=text(subjects[s]+"  "+topics[s][t]+"  "+scores[s][t]+"%",13,Color.WHITE); mastery.addView(topic); topic.setOnClickListener(v->{scores[fs][ft]=Math.min(100,scores[fs][ft]+5); saveScores(); renderHome();}); } content.addView(mastery);
        Button start=button("▶  Start commitment session"); start.setBackgroundColor(BLUE); start.setOnClickListener(v->startSession()); content.addView(start);
    }
    private LinearLayout stat(String label,TextView value){LinearLayout l=new LinearLayout(this);l.setOrientation(LinearLayout.VERTICAL);l.addView(text(label,10,Color.LTGRAY));l.addView(value);return l;}
    private LinearLayout taskCard(String action,String subject,String detail){LinearLayout c=card();TextView a=text(action,16,Color.WHITE);a.setTypeface(Typeface.DEFAULT,Typeface.BOLD);c.addView(a);c.addView(text(subject,13,BLUE));c.addView(text(detail,12,Color.LTGRAY));Button b=button("Mark complete");b.setOnClickListener(v->{store.edit().putInt("completed",store.getInt("completed",0)+1).apply();updateStats();b.setText("✓ Completed");});c.addView(b);return c;}
    private void startSession(){content.removeAllViews();TextView h=text("COMMITMENT MODE",13,BLUE);content.addView(h);TextView intro=text("One task. No switching. You can leave safely, but your streak pauses for today.",18,Color.WHITE);intro.setPadding(0,16,0,22);content.addView(intro);TextView clock=text("25:00",56,Color.WHITE);clock.setGravity(Gravity.CENTER);content.addView(clock);Button go=button("Start focus");go.setBackgroundColor(BLUE);content.addView(go);Button back=button("Exit session");content.addView(back);go.setOnClickListener(v->{if(timer!=null)return;go.setText("Focus in progress");timer=new CountDownTimer(seconds*1000L,1000){public void onTick(long x){seconds=(int)(x/1000);clock.setText(String.format(Locale.US,"%02d:%02d",seconds/60,seconds%60));}public void onFinish(){store.edit().putInt("minutes",store.getInt("minutes",0)+25).apply();timer=null;clock.setText("Done ✓");go.setText("Session complete");}}.start();});back.setOnClickListener(v->{if(timer!=null){new AlertDialog.Builder(this).setTitle("Leave focus?").setMessage("Your progress is safe, but today's commitment streak will pause.").setNegativeButton("Stay",null).setPositiveButton("Leave",(d,w)->{timer.cancel();timer=null;renderHome();}).show();}else renderHome();});}
    private int[] weakest(){int bs=101,bi=0,bj=0;for(int s=0;s<3;s++)for(int t=0;t<4;t++)if(scores[s][t]<bs){bs=scores[s][t];bi=s;bj=t;}return new int[]{bi,bj};}
    private int[] secondWeakest(){int[] w=weakest();int bs=101,bi=0,bj=0;for(int s=0;s<3;s++)for(int t=0;t<4;t++)if(!(s==w[0]&&t==w[1])&&scores[s][t]<bs){bs=scores[s][t];bi=s;bj=t;}return new int[]{bi,bj};}
    private void updateStats(){int total=0;for(int[] row:scores)for(int x:row)total+=x;readiness.setText((total/12)+"%");minutes.setText(store.getInt("minutes",0)+" min");}
    private void loadScores(){String saved=store.getString("scores","");if(saved.isEmpty())return;String[] values=saved.split(",");if(values.length!=12)return;int i=0;for(int s=0;s<3;s++)for(int t=0;t<4;t++)scores[s][t]=Integer.parseInt(values[i++]);}
    private void saveScores(){StringBuilder b=new StringBuilder();for(int[] r:scores)for(int x:r)b.append(x).append(",");store.edit().putString("scores",b.toString()).apply();}
}
