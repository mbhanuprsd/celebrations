// src/firebase/services.js
// All Firebase operations live here — keeps game logic clean and swappable.

import {
  doc, collection, setDoc, updateDoc, onSnapshot,
  serverTimestamp, deleteField, arrayUnion, getDoc
} from 'firebase/firestore';
import {
  ref, set, onValue, off, push, onDisconnect, serverTimestamp as rtServerTimestamp, remove
} from 'firebase/database';
import { signInAnonymously } from 'firebase/auth';
import { db, rtdb, auth } from './index';
import { nanoid } from 'nanoid';

// ─── Auth ──────────────────────────────────────────────────────────────────

export const signInAnon = () => signInAnonymously(auth);

export const getCurrentUser = () => auth.currentUser;

// ─── Room Management ───────────────────────────────────────────────────────

export const createRoom = async (hostName, settings = {}) => {
  const roomId = nanoid(6).toUpperCase();
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('Not authenticated');

  const roomData = {
    id: roomId,
    hostId: userId,
    status: 'waiting',          // waiting | starting | playing | roundEnd | finished
    gameType: 'drawing',
    settings: {
      maxPlayers: settings.maxPlayers || 8,
      rounds: settings.rounds || 3,
      drawTime: settings.drawTime || 80,
      language: settings.language || 'en',
    },
    players: {
      [userId]: {
        id: userId,
        name: hostName,
        score: 0,
        isReady: true,
        isOnline: true,
        avatar: generateAvatar(hostName),
        joinedAt: Date.now(),
      }
    },
    currentRound: 0,
    currentDrawer: null,
    currentWord: null,
    currentWordHint: null,
    roundStartTime: null,
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'rooms', roomId), roomData);
  await setPlayerOnlineStatus(roomId, userId, true);
  return roomId;
};

export const joinRoom = async (roomId, playerName) => {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('Not authenticated');

  const roomRef = doc(db, 'rooms', roomId);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) throw new Error('Room not found');
  const room = roomSnap.data();

  const playerCount = Object.keys(room.players || {}).length;
  if (playerCount >= room.settings.maxPlayers) throw new Error('Room is full');
  if (room.status !== 'waiting') throw new Error('Game already in progress');

  await updateDoc(roomRef, {
    [`players.${userId}`]: {
      id: userId,
      name: playerName,
      score: 0,
      isReady: true,
      isOnline: true,
      avatar: generateAvatar(playerName),
      joinedAt: Date.now(),
    }
  });

  await setPlayerOnlineStatus(roomId, userId, true);
  return room;
};

export const leaveRoom = async (roomId, userId) => {
  const roomRef = doc(db, 'rooms', roomId);
  await updateDoc(roomRef, {
    [`players.${userId}`]: deleteField()
  });
  await setPlayerOnlineStatus(roomId, userId, false);
};

export const setPlayerOnlineStatus = async (roomId, userId, isOnline) => {
  const presenceRef = ref(rtdb, `presence/${roomId}/${userId}`);
  if (isOnline) {
    await set(presenceRef, { online: true, lastSeen: rtServerTimestamp() });
    onDisconnect(presenceRef).set({ online: false, lastSeen: rtServerTimestamp() });
  } else {
    await set(presenceRef, { online: false, lastSeen: rtServerTimestamp() });
  }
};

// ─── Game State Management ─────────────────────────────────────────────────

export const startGame = async (roomId, playerOrder) => {
  const roomRef = doc(db, 'rooms', roomId);
  await updateDoc(roomRef, {
    status: 'playing',
    currentRound: 1,
    playerOrder,
    drawerIndex: 0,
    currentDrawer: playerOrder[0],
    currentWord: null,
    currentWordHint: null,
    roundStartTime: null,
    guessedPlayers: {},
  });
};

export const selectWord = async (roomId, word) => {
  const hint = generateHint(word);
  await updateDoc(doc(db, 'rooms', roomId), {
    currentWord: word,
    currentWordHint: hint,
    status: 'playing',
    roundStartTime: serverTimestamp(),
    guessedPlayers: {},
  });
};

export const submitGuess = async (roomId, userId, playerName, guess, currentWord) => {
  const isCorrect = guess.toLowerCase().trim() === currentWord.toLowerCase().trim();
  
  // Add message to chat
  await sendChatMessage(roomId, userId, playerName, guess, isCorrect ? 'correct' : 'chat');
  
  return isCorrect;
};

export const recordCorrectGuess = async (roomId, userId, score, timeBonus) => {
  await updateDoc(doc(db, 'rooms', roomId), {
    [`guessedPlayers.${userId}`]: { score, timeBonus, time: Date.now() },
    [`players.${userId}.score`]: score,
  });
};

export const updateDrawerScore = async (roomId, drawerId, bonus) => {
  const roomSnap = await getDoc(doc(db, 'rooms', roomId));
  const currentScore = roomSnap.data()?.players?.[drawerId]?.score || 0;
  await updateDoc(doc(db, 'rooms', roomId), {
    [`players.${drawerId}.score`]: currentScore + bonus,
  });
};

export const advanceRound = async (roomId, playerOrder, drawerIndex, currentRound, totalRounds) => {
  const nextDrawerIndex = (drawerIndex + 1) % playerOrder.length;
  const nextRound = nextDrawerIndex === 0 ? currentRound + 1 : currentRound;
  
  if (nextRound > totalRounds) {
    await updateDoc(doc(db, 'rooms', roomId), {
      status: 'finished',
      currentDrawer: null,
      currentWord: null,
      currentWordHint: null,
    });
    return false;
  }

  await updateDoc(doc(db, 'rooms', roomId), {
    status: 'selectingWord',
    currentRound: nextRound,
    drawerIndex: nextDrawerIndex,
    currentDrawer: playerOrder[nextDrawerIndex],
    currentWord: null,
    currentWordHint: null,
    roundStartTime: null,
    guessedPlayers: {},
  });
  return true;
};

export const endRound = async (roomId) => {
  await updateDoc(doc(db, 'rooms', roomId), {
    status: 'roundEnd',
  });
};

export const resetRoom = async (roomId, hostId) => {
  const roomSnap = await getDoc(doc(db, 'rooms', roomId));
  const room = roomSnap.data();
  const resetPlayers = {};
  Object.keys(room.players).forEach(pid => {
    resetPlayers[pid] = { ...room.players[pid], score: 0 };
  });
  await updateDoc(doc(db, 'rooms', roomId), {
    status: 'waiting',
    currentRound: 0,
    currentDrawer: null,
    currentWord: null,
    currentWordHint: null,
    roundStartTime: null,
    guessedPlayers: {},
    players: resetPlayers,
  });
  await clearCanvas(roomId);
};

// ─── Real-time Canvas (RTDB for low latency) ──────────────────────────────

export const pushStroke = async (roomId, stroke) => {
  const strokesRef = ref(rtdb, `canvas/${roomId}/strokes`);
  await push(strokesRef, stroke);
};

export const clearCanvas = async (roomId) => {
  const canvasRef = ref(rtdb, `canvas/${roomId}`);
  await set(canvasRef, { cleared: Date.now() });
};

export const listenCanvas = (roomId, onStroke, onClear) => {
  const strokesRef = ref(rtdb, `canvas/${roomId}/strokes`);
  const clearedRef = ref(rtdb, `canvas/${roomId}/cleared`);

  onValue(strokesRef, (snap) => {
    const val = snap.val();
    if (val) onStroke(Object.values(val));
    else onStroke([]);
  });

  onValue(clearedRef, (snap) => {
    if (snap.val()) onClear();
  });

  return () => {
    off(strokesRef);
    off(clearedRef);
  };
};

// ─── Chat ──────────────────────────────────────────────────────────────────

export const sendChatMessage = async (roomId, userId, playerName, text, type = 'chat') => {
  const chatRef = ref(rtdb, `chat/${roomId}`);
  await push(chatRef, {
    userId,
    playerName,
    text,
    type,   // chat | correct | system | hint
    time: rtServerTimestamp(),
  });
};

export const sendSystemMessage = async (roomId, text) => {
  const chatRef = ref(rtdb, `chat/${roomId}`);
  await push(chatRef, {
    userId: 'system',
    playerName: 'System',
    text,
    type: 'system',
    time: rtServerTimestamp(),
  });
};

export const listenChat = (roomId, callback) => {
  const chatRef = ref(rtdb, `chat/${roomId}`);
  onValue(chatRef, (snap) => {
    const val = snap.val();
    if (val) {
      const messages = Object.entries(val).map(([id, msg]) => ({ id, ...msg }));
      callback(messages.slice(-100)); // keep last 100
    } else {
      callback([]);
    }
  });
  return () => off(chatRef);
};

export const clearChat = async (roomId) => {
  await remove(ref(rtdb, `chat/${roomId}`));
};

// ─── Room Listener ─────────────────────────────────────────────────────────

export const listenRoom = (roomId, callback) => {
  return onSnapshot(doc(db, 'rooms', roomId), (snap) => {
    if (snap.exists()) callback(snap.data());
    else callback(null);
  });
};

// ─── Word Bank ─────────────────────────────────────────────────────────────

export const getWordChoices = (count = 3) => {
  const pool = WORD_BANK.en;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

// ─── Helpers ───────────────────────────────────────────────────────────────

export const generateHint = (word) => {
  return word.split(' ').map(w =>
    w.split('').map((ch, i) => (i === 0 ? ch : '_')).join('')
  ).join(' ');
};

export const revealHintCharacter = (word, hint) => {
  const wordArr = word.split('');
  const hintArr = hint.split('');
  const hidden = hintArr.map((c, i) => c === '_' ? i : null).filter(i => i !== null);
  if (!hidden.length) return hint;
  const revealIdx = hidden[Math.floor(Math.random() * hidden.length)];
  const newHint = hintArr.map((c, i) => i === revealIdx ? wordArr[i] : c);
  return newHint.join('');
};

const AVATAR_COLORS = ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#F72585','#7209B7','#3A0CA3','#4361EE','#4CC9F0','#06D6A0'];
export const generateAvatar = (name) => {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return { color: AVATAR_COLORS[idx], initials: name.slice(0, 2).toUpperCase() };
};

// ─── Word Bank ─────────────────────────────────────────────────────────────

const WORD_BANK = {
  en: [
    // Animals (150)
    'elephant','dolphin','penguin','giraffe','kangaroo','octopus','butterfly','crocodile',
    'hamster','peacock','flamingo','jellyfish','porcupine','cheetah','gorilla','platypus',
    'aardvark','alligator','alpaca','anteater','antelope','armadillo','baboon','badger',
    'barracuda','bat','bear','beaver','bee','bison','boar','buffalo','bull','camel',
    'canary','capybara','cat','chameleon','chimpanzee','chinchilla','chipmunk','cobra',
    'cougar','cow','coyote','crab','crane','cricket','crow','deer','dinosaur','dog',
    'donkey','dove','duck','eagle','eel','elk','emu','falcon','ferret','finch','fish',
    'fly','fox','frog','gazelle','gecko','gerbil','goat','goose','gopher','grasshopper',
    'grouse','guinea pig','gull','hamster','hare','hawk','hedgehog','heron','hippopotamus',
    'horse','hummingbird','hyena','ibex','ibis','iguana','impala','jackal','jaguar',
    'jay','koala','komodo dragon','kookaburra','ladybug','lemur','leopard','lion',
    'lizard','llama','lobster','lynx','macaw','magpie','mallard','manatee','marmoset',
    'marten','meerkat','mink','mole','monkey','moose','mosquito','moth','mouse',
    'mule','narwhal','newt','nightingale','ocelot','okapi','opossum','ostrich','otter',
    'owl','ox','oyster','panda','panther','parrot','partridge','pelican','pheasant',
    'pig','pigeon','piranha','polar bear','poodle','prawn','puma','python','quail',
    'rabbit','raccoon','rat','raven','reindeer','rhinoceros','salamander','salmon',
    'scorpion','seahorse','seal','shark','sheep','shrimp','skunk','sloth','snail',
    'snake','sparrow','spider','squid','squirrel','starfish','stork','swan','tapir',
    'tarantula','tiger','toad','toucan','trout','turkey','turtle','vulture','walrus',
    'wasp','whale','wolf','wolverine','wombat','woodpecker','yak','zebra',

    // Food & Drink (150)
    'pizza','spaghetti','hamburger','sushi','waffle','croissant','pretzel','burrito',
    'pancake','donut','cupcake','popcorn','nachos','avocado','pineapple','watermelon',
    'apple','apricot','artichoke','asparagus','bacon','bagel','banana','barley',
    'basil','bean','beef','beet','berry','biscuit','blackberry','blueberry','bouillon',
    'bread','broccoli','brownie','cabbage','cake','candy','cantaloupe','carrot',
    'cashew','cauliflower','celery','cereal','cheese','cherry','chicken','chili',
    'chips','chocolate','chowder','cinnamon','clam','coconut','cod','coffee',
    'cookie','corn','crab','cracker','cranberry','cream','cucumber','curry',
    'custard','date','dessert','dill','dressing','dumpling','egg','eggplant',
    'fig','flour','garlic','ginger','grape','grapefruit','gravy','guava','haddock',
    'halibut','ham','honey','honeydew','hummus','ice cream','jam','jelly','kale',
    'kebab','ketchup','kiwi','lasagna','lemon','lentil','lettuce','lime','lobster',
    'macaroni','mango','maple','margarine','marshmallow','melon','milk','mint',
    'muffin','mushroom','mussel','mustard','noodle','nut','oatmeal','olive',
    'onion','orange','oregano','oyster','paprika','parsley','parsnip','pasta',
    'peach','peanut','pear','peas','pecan','pepper','pepperoni','pickle','pie',
    'pistachio','plum','pork','potato','pudding','pumpkin','radish','raisin',
    'raspberry','ravioli','rice','rosemary','salad','salami','salmon','salt',
    'sandwich','sausage','scallop','shrimp','soup','spinach','squash','steak',
    'strawberry','sugar','syrup','taco','tangerine','tea','thyme','tofu','tomato',
    'trout','tuna','turkey','turmeric','vanilla','veal','vinegar','walnut','wheat',
    'yogurt','zucchini',

    // Objects & Tools (150)
    'umbrella','telescope','skateboard','microscope','lighthouse','backpack','hammock',
    'compass','parachute','hourglass','trophy','binoculars','megaphone','lawnmower',
    'anchor','anvil','arrow','axe','balloon','basket','battery','bed','bell',
    'bicycle','blanket','boat','book','bottle','bowl','box','bracelet','bridge',
    'broom','brush','bucket','button','calculator','camera','candle','canoe',
    'canvas','car','cardboard','carpet','cart','case','casket','castle','chain',
    'chair','chalk','chisel','clock','cloth','coat','coin','comb','computer',
    'container','couch','cup','curtain','cushion','desk','device','diaper',
    'dictionary','dish','doll','door','drawer','drill','drum','dustpan','earring',
    'easel','eraser','fan','fence','file','filter','flag','flashlight','flask',
    'flute','fork','frame','fridge','funnel','furnace','furniture','gate','gear',
    'glass','glove','glue','goggles','guitar','hammer','handbag','harness','hat',
    'helmet','hinge','hook','hose','iron','jacket','jar','jewelry','kettle',
    'key','keyboard','knife','ladder','lamp','lantern','laptop','leash','lens',
    'letter','lock','locket','loom','magnet','mask','match','mattress','mirror',
    'mobile','monitor','mop','motor','needle','net','notebook','oar','oven',
    'padlock','paintbrush','pan','paper','pen','pencil','phone','piano','picture',
    'pillow','pipe','plate','pliers','plow','pocket','pot','printer','prism',
    'puppet','purse','puzzle','quilt','radio','raft','rail','rake','razor',
    'record','remote','ring','robot','rocket','rope','ruler','saddle','sail',
    'saw','scale','scissors','screw','seat','shampoo','shelf','shell','shield',
    'shirt','shoe','shovel','sieve','skillet','sledge','soap','sock','sofa',
    'spade','spoon','spring','stamp','stapler','statue','stick','stove','suit',
    'table','tablet','tape','teapot','telephone','tent','thermometer','thimble',
    'ticket','tire','toaster','toilet','torch','towel','toy','train','tray',
    'truck','trunk','tube','tv','typewriter','unicycle','vacuum','vase','vest',
    'violin','wallet','watch','weapon','wheel','whistle','window','wire','wrench',
    'zipper',

    // Places & Buildings (120)
    'library','volcano','pyramid','igloo','stadium','hospital','aquarium','factory',
    'skyscraper','submarine','treehouse','windmill','greenhouse','cathedral','observatory',
    'airport','apartment','arena','attic','bakery','bank','barn','basement','beach',
    'bedroom','bridge','cabin','cafe','camp','canyon','castle','cave','cemetery',
    'chapel','church','cinema','city','clinic','coast','college','cottage','court',
    'desert','diner','dock','dormitory','farm','field','forest','fortress','garage',
    'garden','glacier','gym','harbor','highway','hill','hotel','house','island',
    'jungle','kitchen','lake','market','meadow','monastery','monument','mountain',
    'museum','office','orchard','palace','park','pharmacy','playground','plaza',
    'pond','port','prison','quarry','railway','ranch','reef','restaurant','river',
    'road','roof','room','school','sea','shack','shed','shop','shore','shrine',
    'station','store','street','swamp','temple','theater','tower','town','tunnel',
    'university','valley','village','warehouse','woods','yard','zoo',

    // Actions & Verbs (120)
    'swimming','juggling','skydiving','snowboarding','surfing','climbing','dancing',
    'painting','knitting','cooking','gardening','cycling','fishing','camping','hiking',
    'acting','baking','bathing','beating','bending','biting','blowing','blushing',
    'bouncing','bowling','breaking','breathing','brushing','building','burning',
    'buying','calling','catching','chasing','chewing','chopping','clapping','cleaning',
    'closing','combing','coughing','counting','crawling','crying','cutting','digging',
    'diving','drawing','dreaming','drinking','driving','eating','falling','feeding',
    'fighting','flying','folding','giving','growing','hanging','hiding','hitting',
    'hopping','hugging','humming','jumping','kicking','kissing','knocking','laughing',
    'leaping','licking','lifting','listening','marching','mixing','mowing','nodding',
    'opening','packing','peeling','playing','pointing','pulling','pushing','reading',
    'riding','running','sailing','scanning','scratching','screaming','sewing','shaking',
    'shouting','singing','sitting','skating','skipping','sleeping','sliding','smiling',
    'sneezing','snoring','spinning','splashing','standing','staring','stepping','sweeping',
    'swinging','talking','tapping','throwing','tickling','typing','walking','washing',
    'watching','waving','whispering','whistling','writing','yawning','yelling',

    // Abstract & Nature (120)
    'rainbow','thunder','eclipse','tornado','avalanche','tsunami','blizzard','mirage',
    'gravity','infinity','silence','shadow','reflection','imagination','adventure',
    'anger','autumn','beauty','belief','birth','bravery','breeze','chaos','charity',
    'cloud','comfort','courage','culture','danger','darkness','dawn','death',
    'delight','destiny','dew','dream','drought','dusk','duty','earthquake','echo',
    'energy','envy','eternity','existence','failure','faith','fame','fantasy',
    'fear','fire','fog','fortune','freedom','friendship','frost','fury','glory',
    'gossip','gratitude','grief','guilt','happiness','harvest','hate','health',
    'heart','heaven','history','holiness','honesty','honor','hope','horror',
    'humor','hunger','ice','idea','justice','kindness','knowledge','law','liberty',
    'life','light','lightning','love','luck','luxury','magic','memory','mercy',
    'mist','mystery','nature','night','ocean','opinion','pain','patience','peace',
    'poverty','power','pride','rain','reality','relief','religion','rhythm',
    'rumor','safety','science','season','shame','skill','sleep','snow','solitude',
    'soul','space','spirit','spring','star','storm','strength','success','summer',
    'sun','sunrise','sunset','surprise','talent','theory','thought','time','truth',
    'union','universe','victory','virtue','voice','war','water','wealth','weather',
    'wind','winter','wisdom','wonder','work','world','youth',

    // Occupations & People (100)
    'astronaut','wizard','pirate','ninja','superhero','zombie','vampire','mermaid',
    'actor','architect','artist','athlete','author','baker','barber','blacksmith',
    'builder','butcher','captain','carpenter','chef','clown','coach','cook',
    'cowboy','dancer','dentist','detective','doctor','driver','editor','engineer',
    'farmer','firefighter','fisherman','gardener','guard','hunter','judge','knight',
    'lawyer','librarian','magician','manager','mechanic','miner','monk','musician',
    'nurse','officer','painter','photographer','pilot','plumber','police','politician',
    'postman','president','priest','prince','princess','professor','sailor','scientist',
    'sculptor','secretary','servant','singer','soldier','spy','student','surgeon',
    'teacher','thief','tourist','trainer','waiter','warrior','weaver','writer',

    // Adjectives/Descriptors (100)
    'ancient','beautiful','bitter','bright','broken','calm','careful','cheap',
    'clean','clever','cold','colorful','comfortable','cool','courageous','curly',
    'dangerous','dark','delicious','different','difficult','dirty','dry','early',
    'easy','electric','elegant','empty','expensive','famous','fast','fat',
    'fierce','flat','fluffy','foolish','fresh','friendly','funny','gentle',
    'giant','good','great','greedy','green','guilty','happy','hard','heavy',
    'helpful','high','hollow','hot','huge','hungry','important','impossible',
    'innocent','intelligent','interesting','itchy','kind','large','lazy','light',
    'little','long','loud','lovely','low','lucky','magnificent','modern','narrow',
    'nasty','nervous','new','nice','noisy','old','orange','ordinary','perfect',
    'poor','powerful','precious','pretty','proud','quick','quiet','rare','ready',
    'rich','rotten','rough','round','rude','sad','safe','salty','sharp','shiny',
    'short','shy','silent','simple','slow','small','smooth','soft','sour','special',
    'square','steep','sticky','stiff','strange','strong','sudden','sweet','tall',
    'tame','thick','thin','tiny','tough','ugly','unusual','useful','vast','warm',
    'weak','weary','wet','wide','wild','wise','wonderful','wooden','wrong','young',

    // Technology & Science (100)
    'algorithm','antenna','atom','bacteria','blueprint','broadcast','browser','cable',
    'capsule','cell','chip','circuit','clone','code','comet','component','console',
    'data','database','desktop','digital','discovery','disk','display','dna','domain',
    'electron','element','engine','experiment','fiber','file','filter','formula',
    'fossil','fuel','galaxy','gas','genetic','glitch','graph','hardware','helium',
    'hormone','hydrogen','icon','input','instrument','interface','internet','invader',
    'invention','iron','keyboard','laser','lens','liquid','logic','machine','matrix',
    'measure','media','memory','metal','methane','microchip','mineral','modem','molecule',
    'monitor','motion','network','neutron','nitrogen','nuclear','orbit','oxygen',
    'particle','password','physics','pixel','planet','plasma','platform','plugin',
    'polymer','process','program','proton','pulse','quantum','radar','radiation',
    'radio','reaction','reboot','robotics','rocket','satellite','scanner','screen',
    'sensor','server','signal','silicon','software','solar','spectrum','sphere',
    'static','steam','sulfur','switch','system','tablet','technique','telescope',
    'theory','thermal','toxin','transistor','transmitter','vacuum','vapor','velocity',
    'vibration','video','virus','voltage','wave','website','wire',
  ]
};
