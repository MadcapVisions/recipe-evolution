module.exports=[97625,e=>{"use strict";let t=`
You are Recipe Evolution's AI sous chef.

Your job is to help a home cook quickly turn a rough idea into a strong meal direction.

Core behavior:
- Be direct, useful, and specific.
- Sound like a skilled cooking assistant, not a performer.
- Stay within cooking and adjacent kitchen tasks only.
- Do not use theatrical phrasing like "Ah, my friend" or exaggerated praise.
- Avoid repeating the user's request back to them unless needed for clarity.
- If the user asks for one specific dish or clearly chooses one direction, stay on that direction only.
- Do not volunteer alternate dishes, variants, or multiple options unless the user explicitly asks for ideas, options, alternatives, or variations.
- Treat sauces, dips, snacks, sides, spreads, and appetizers as valid cooking requests.
- Once the conversation moves from "show me options" to "let's do this one," treat earlier discarded options as irrelevant background.
- In refinement mode, keep the current dish format locked unless the user explicitly changes it.
- If the user has already given enough context, answer decisively.
- Ask a follow-up only when it materially changes the recommendation.
- If an unanswered detail would materially change the final recipe, ask that one clarifying question instead of guessing.
- If the user asks for a general non-cooking conversation, refuse briefly and redirect them to cooking topics.

Chat mode rules:
- This is ideation mode only.
- Do NOT output a full recipe.
- Do NOT output full ingredients lists.
- Do NOT output full step-by-step instructions.
- Do NOT output "Recipe Name / Ingredients / Instructions / Chef Tips" format.

Response format:
- Usually 2-4 sentences or a very tight bullet list.
- Start with the recommendation, not filler.
- Lead with the single best direction first.
- Give concrete flavor direction, ingredient pairings, or technique suggestions.
- If offering alternatives because the user asked for them, cap it at 2 additional directions.
- Keep each direction compact and avoid repeating the same structure with minor wording changes.
- End with at most one short, high-signal follow-up question, and only if needed.

Good response example:
"Your best lunch option is a bright chicken-broccoli salad with a lemon-Dijon vinaigrette, toasted almonds, and shaved parmesan. If you want it heartier, go in a chicken broccoli pasta-salad direction with herbs and a yogurt-lemon dressing. If you want the freshest version, keep it crisp with celery, scallions, and lots of lemon. Do you want creamy or vinaigrette-based?"

Bad response example:
"That sounds fantastic. Tell me more about what inspires you, what meal this is for, and what flavors you enjoy."

Use any provided flavor, substitution, and cooking context. Prioritize delicious, realistic, home-cook-friendly guidance.
`;e.s(["CHEF_SYSTEM_PROMPT",0,t])},58409,e=>{"use strict";async function t(e,t,r,i){let{error:n}=await e.from("product_events").insert({owner_id:t,event_name:r,metadata_json:i??null});n&&console.error("Failed to track server product event",n.message)}e.s(["trackServerEvent",()=>t])},90193,e=>{"use strict";var t=e.i(54799);let r={home_ideas:7,home_recipe:30,structure:90,refine:90,nutrition:30};function i(e){return(0,t.createHash)("sha256").update(function e(t){if(null===t||"object"!=typeof t)return JSON.stringify(t);if(Array.isArray(t))return`[${t.map(t=>e(t)).join(",")}]`;let r=Object.entries(t).sort(([e],[t])=>e.localeCompare(t));return`{${r.map(([t,r])=>`${JSON.stringify(t)}:${e(r)}`).join(",")}}`}(e)).digest("hex")}async function n(e,t,i,n){let a=r[i],s=new Date(Date.now()-24*a*36e5).toISOString(),{data:o,error:l}=await e.from("ai_cache").select("response_json, created_at, model").eq("owner_id",t).eq("purpose",i).eq("input_hash",n).gte("created_at",s).order("created_at",{ascending:!1}).limit(1).maybeSingle();return l?(console.warn(`AI cache read failed for ${i}:`,l.message),null):o}async function a(e,t,r,i,n,a){let{error:s}=await e.from("ai_cache").upsert({owner_id:t,purpose:r,input_hash:i,model:n,response_json:a},{onConflict:"owner_id,purpose,input_hash,model"});s&&console.warn(`AI cache write failed for ${r}:`,s.message)}e.s(["hashAiCacheInput",()=>i,"readAiCache",()=>n,"writeAiCache",()=>a])},82252,e=>{"use strict";let t=["italian","mexican","asian","mediterranean","comfort","healthy","seafood","dessert"],r=["chicken","beef","pork","fish","salmon","shrimp","tofu","beans","eggs","turkey","chickpeas"],i=["spicy","bright","creamy","fresh","herby","smoky","savory","crispy","lemon","lime","garlic"];function n(e){return(e??[]).map(e=>e.trim()).filter(Boolean)}function a(e,t){let r=new Map,i=e.join(" ").toLowerCase();for(let e of t)i.includes(e)&&r.set(e,(r.get(e)??0)+1);return r}function s(e,t=3){return Array.from(e.entries()).sort((e,t)=>t[1]-e[1]).slice(0,t).map(([e])=>e)}function o(e,t){return e.flatMap(e=>Array.from({length:t},()=>e))}async function l(e,t){let{data:r}=await e.from("user_taste_profiles").select("combined_summary, updated_at").eq("owner_id",t).maybeSingle();return r?.combined_summary&&Date.now()-new Date(r.updated_at).getTime()<3e5?r.combined_summary:c(e,t)}async function c(e,l){var c;let u,d,p,m,f,h,g,y=e.from("user_preferences").select("preferred_units, common_diet_tags, disliked_ingredients, cooking_skill_level, favorite_cuisines, favorite_proteins, preferred_flavors, pantry_staples, spice_tolerance, health_goals, taste_notes").eq("owner_id",l).maybeSingle?.(),_=e.from("recipes").select("id, title, tags, is_favorite").eq("owner_id",l).order("updated_at",{ascending:!1}).limit(20),v=e.from("product_events").select("event_name, metadata_json").eq("owner_id",l).order("created_at",{ascending:!1}).limit(80),w=e.from("ai_conversation_turns").select("message, scope, role").eq("owner_id",l).order("created_at",{ascending:!1}).limit(80),[b,k,A,j]=await Promise.all([y??Promise.resolve({data:null,error:null}),_??Promise.resolve({data:[],error:null}),v??Promise.resolve({data:[],error:null}),w??Promise.resolve({data:[],error:null})]),T=b?.data??null,S=k?.data,x=Array.isArray(S)?S:[],I=A?.data,C=Array.isArray(I)?I:[],q=j?.data,$=Array.isArray(q)?q:[],O=x.map(e=>String(e?.id??"")).filter(Boolean),D=O.length>0?await e.from("recipe_versions").select("ingredients_json, recipe_id").in("recipe_id",O).order("created_at",{ascending:!1}).limit(24):{data:[],error:null},M=D?.data,N=Array.isArray(M)?M:[],F=x.filter(e=>e?.is_favorite),P=[...o(F.map(e=>String(e?.title??"").trim()).filter(Boolean),2)].concat(x.map(e=>String(e?.title??"").trim()).filter(Boolean)),R=[...F,...x].flatMap(e=>Array.isArray(e?.tags)?e.tags:[]).map(e=>String(e).trim()).filter(Boolean),E=N.flatMap(e=>Array.isArray(e?.ingredients_json)?e.ingredients_json:[]).map(e=>String(e?.name??"").trim()).filter(Boolean),B=C.flatMap(e=>{let t=function(e){if(!e)return[];let t=[];for(let r of["title","description","prompt","instruction","recipeTitle","ideaTitle","selectedIdeaTitle","conversation","versionLabel"])t.push(...function e(t){return"string"==typeof t&&t.trim()?[t.trim()]:Array.isArray(t)?t.flatMap(t=>e(t)):t&&"object"==typeof t?Object.values(t).flatMap(t=>e(t)):[]}(e[r]));return t}(e.metadata_json);return"recipe_favorited"===e.event_name||"recipe_created"===e.event_name||"recipe_improved"===e.event_name||"recipe_remixed"===e.event_name?o(t,2):t}),L=$.flatMap(e=>{let t="string"==typeof e.message?e.message.trim():"";return t?"user"===e.role?o([t],2):[t]:[]}),J=function(e){if(!e)return"";let t=[],r=n(e.favorite_cuisines),i=n(e.favorite_proteins),a=n(e.preferred_flavors),s=n(e.common_diet_tags),o=n(e.pantry_staples),l=n(e.health_goals),c=n(e.disliked_ingredients);return r.length>0&&t.push(`Prefers ${r.join(", ")} styles.`),i.length>0&&t.push(`Often wants ${i.join(", ")}.`),a.length>0&&t.push(`Likes ${a.join(", ")} flavors.`),s.length>0&&t.push(`Diet goals: ${s.join(", ")}.`),l.length>0&&t.push(`Health goals: ${l.join(", ")}.`),e.spice_tolerance?.trim()&&t.push(`Spice tolerance: ${e.spice_tolerance.trim()}.`),c.length>0&&t.push(`Avoid ${c.join(", ")}.`),o.length>0&&t.push(`Common pantry staples include ${o.join(", ")}.`),e.cooking_skill_level?.trim()&&t.push(`Cooking skill: ${e.cooking_skill_level.trim()}.`),e.taste_notes?.trim()&&t.push(e.taste_notes.trim()),t.join(" ")}(T),Y=(u=a([...(c={recipeTitles:[...P,...B,...L],recipeTags:R,ingredientNames:[...E,...B,...L]}).recipeTitles,...c.recipeTags],t),d=a([...c.recipeTitles,...c.ingredientNames],r),p=a([...c.recipeTitles,...c.ingredientNames],i),m=s(u),f=s(d),h=s(p),g=[],m.length>0&&g.push(`Recent behavior leans toward ${m.join(", ")} dishes.`),f.length>0&&g.push(`Frequently chosen ingredients include ${f.join(", ")}.`),h.length>0&&g.push(`Observed taste signals suggest ${h.join(", ")} preferences.`),{summary:g.join(" "),signals:{cuisines:m,proteins:f,flavors:h}}),U=[J,Y.summary].filter(Boolean).join(" ");return U&&(async()=>{let{error:t}=await e.from("user_taste_profiles").upsert({owner_id:l,explicit_summary:J||null,inferred_summary:Y.summary||null,combined_summary:U,inferred_signals_json:Y.signals},{onConflict:"owner_id"});t&&console.warn("Failed to update user taste profile",t.message)})(),U}e.s(["getCachedUserTasteSummary",()=>l])},94744,e=>{"use strict";var t=e.i(41755),r=e.i(97625),i=e.i(90193),n=e.i(17581),a=e.i(81030),s=e.i(99546);let o=new Set(["the","a","an","and","or","but","in","on","at","to","for","of","with","this","that","it","can","you","i","we","my","me","please","some","add","make","use","swap","want","would","like","could","recipe","dish","version","into","from","more","less","also","just"]);async function l(e,l){let c=l?(0,i.hashAiCacheInput)({instruction:e.instruction,userTasteSummary:e.userTasteSummary?.trim()||null,recipe:e.recipe}):null;if(l&&c){let e=await (0,i.readAiCache)(l.supabase,l.userId,"refine",c);if(e){let t=(0,n.parseAiRecipeResult)(e.response_json);if(t)return t}}let u=[{role:"system",content:`${r.CHEF_SYSTEM_PROMPT}

User taste summary: ${e.userTasteSummary?.trim()||"No user taste summary available."}

When asked to improve a recipe, you must return ONLY valid JSON with no markdown:
{
  "title": string,
  "version_label": string,
  "explanation": string,
  "servings": number|null,
  "prep_time_min": number|null,
  "cook_time_min": number|null,
  "difficulty": string|null,
  "ingredients": [{ "name": string, "quantity": number, "unit": string|null, "prep": string|null }],
  "steps": [{ "text": string }]
}

Rules:
- version_label: 2-4 words describing what changed, suitable for a version badge. Examples: "With Potatoes", "Dairy-Free", "Spicier Version", "Faster Cook", "Added Lemon". Use title case. Do not include the word "recipe".
- Always make changes that directly and visibly address the instruction. Vague rewrites are not acceptable.
- For "spicier" or "more heat": increase or add chili, cayenne, jalape\xf1o, gochujang, or hot sauce — make at least 2 ingredient-level changes.
- For "simpler" or "fewer ingredients": reduce the ingredient count by at least 2-3 items and combine or cut steps.
- For "faster" or "quicker": lower cook_time_min meaningfully, prefer high-heat techniques over braises, and cut prep steps.
- For "healthier" or "lighter": reduce butter, oil, cream, and cheese; add vegetables or lean protein; lower calorie density.
- For "richer" or "creamier": add cream, butter, or cheese; deepen the sauce base; use fond or stock reduction.
- For "more flavor" or "bolder": amplify aromatics (garlic, onion, shallot), add acid (lemon, vinegar), or add umami (parmesan, soy, miso, fish sauce).
- For "vegetarian" or "vegan": swap meat proteins for legumes, tofu, or tempeh; ensure the swap preserves texture and flavor weight.
- Preserve the core dish identity and format unless the instruction explicitly says to change it.
- Every ingredient must include an explicit quantity. Good: 2 onions, 1.5 lb chicken, 2 tbsp olive oil. Bad: onion, chicken, olive oil.
- Keep steps practical and home-cook friendly.
- Each step must contain an actionable cooking verb and enough detail to be unambiguous — include timing, temperature, or doneness cues where relevant. Never write vague steps like "Cook until done" or "Add ingredients."
- Produce a complete recipe, not notes. Every step should be executable without guessing.
- Do not include any text outside the JSON object.`},{role:"user",content:`Instruction:
${e.instruction}

Current recipe:
${JSON.stringify(e.recipe,null,2)}`}],d=await (0,s.resolveAiTaskSettings)("recipe_improvement");if(!d.enabled)throw Error("Recipe improvement AI task is disabled.");let p={max_tokens:d.maxTokens,temperature:d.temperature,model:d.primaryModel,fallback_models:d.fallbackModel?[d.fallbackModel]:[]},m=null,f="";for(let r=0;r<2;r++){var h,g,y;let i=await (0,t.callAIForJson)(u,p),{parsed:s}=i;if(!s||"object"!=typeof s){f="AI returned invalid recipe payload.";continue}let l=Array.isArray(h=s.ingredients)?h.map(e=>{if(!e||"object"!=typeof e)return null;let t=e.name;return"string"==typeof t&&t.trim()?{name:(0,a.formatIngredientLine)({name:t,quantity:"number"==typeof e.quantity?e.quantity:null,unit:"string"==typeof e.unit?e.unit:null,prep:"string"==typeof e.prep?e.prep:null})||t.trim()}:null}).filter(e=>null!==e):[],d=Array.isArray(g=s.steps)?g.map(e=>{if(!e||"object"!=typeof e)return null;let t=e.text;return"string"==typeof t&&t.trim()?{text:t.trim()}:null}).filter(e=>null!==e):[],_="string"==typeof s.title&&s.title.trim()?s.title.trim():e.recipe.title;if(y={title:_,ingredients:l.map(e=>e.name),steps:d.map(e=>e.text),chefTips:Array.isArray(s.chefTips)?s.chefTips.filter(e=>"string"==typeof e&&e.trim().length>0).map(e=>e.trim()):[]},!("object"==typeof y&&"string"==typeof y.title&&Array.isArray(y.ingredients)&&Array.isArray(y.steps)&&y.ingredients.every(e=>"string"==typeof e)&&y.steps.every(e=>"string"==typeof e)&&(void 0===y.chefTips||Array.isArray(y.chefTips)&&y.chefTips.every(e=>"string"==typeof e)))||0){f="Invalid recipe format returned by AI";continue}let v="string"==typeof s.explanation&&s.explanation.trim().length>0?s.explanation.trim():null,w="string"==typeof s.version_label&&s.version_label.trim().length>0?s.version_label.trim():null,b=(0,n.createAiRecipeResult)({purpose:"refine",source:"ai",provider:i.provider,model:i.model??i.provider,cached:!1,inputHash:c,createdAt:new Date().toISOString(),explanation:v,version_label:w,recipe:{title:_,description:null,tags:null,servings:"number"==typeof s.servings?s.servings:e.recipe.servings,prep_time_min:"number"==typeof s.prep_time_min?s.prep_time_min:e.recipe.prep_time_min,cook_time_min:"number"==typeof s.cook_time_min?s.cook_time_min:e.recipe.cook_time_min,difficulty:"string"==typeof s.difficulty&&s.difficulty.trim().length>0?s.difficulty.trim():e.recipe.difficulty,ingredients:l,steps:d}});if(0===r&&!function(e,t){let r=[...t.recipe.ingredients.map(e=>e.name.toLowerCase()),...t.recipe.steps.map(e=>e.text.toLowerCase())].join(" "),i=e.toLowerCase().replace(/[^a-z\s-]/g," ").split(/\s+/).filter(e=>e.length>=4&&!o.has(e));return 0===i.length||i.filter(e=>r.includes(e)).length>=Math.ceil(.4*i.length)}(e.instruction,b)){f="Instruction not reflected in result";continue}m=b;break}if(!m)throw Error(f||"Recipe improvement failed after retry.");return l&&c&&await (0,i.writeAiCache)(l.supabase,l.userId,"refine",c,m.meta.model??m.meta.provider??"unknown",m),m}e.s(["improveRecipe",()=>l],94744)}];

//# sourceMappingURL=lib_e9d6f75c._.js.map