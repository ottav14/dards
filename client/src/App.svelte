<script lang="ts">
    import CrazyEightsPage from './pages/CrazyEightsPage.svelte';
    import GoFishPage from './pages/GoFishPage.svelte';
    import TexasHoldemPage from './pages/TexasHoldemPage.svelte';
    import LoginPage from './pages/LoginPage.svelte';
    import LobbyPage from './pages/LobbyPage.svelte';
    import MainMenuPage from './pages/MainMenuPage.svelte';
    import OfficialLobbiesPage from './pages/OfficialLobbiesPage.svelte';
    import GameEndPage from './pages/GameEndPage.svelte';

    let playerCount = 1;
    let gameStarted = false;
    let game = '';
    let playing = false;
    let loginedIn = false;
    let hand: string[] = [];
    let money: number = 0;
    let pot: number = 0;
    let currentTurnName: string = '';
    let topCard = '';
    let page = 'login';
    let lobbyPlayerCounts: number[];
    let loginErrorMessage = '';
    let gameDisplayText = '';
    let gameEndReason = '';
    let gameEndUser = '';
    let books: string[] = [];
    let canDraw = false;
    let canAsk = true;
    let smallBlind = false;
    let bigBlind = false;

    const ws = new WebSocket("ws://localhost:5173/ws");
    let sessionID: string = '';
    let username: string = '';
    let lobbyData: any[];

    const rankWords: Record<string, string> = {
        'A': 'aces',
        '2': 'twos',
        '3': 'threes',
        '4': 'fours',
        '5': 'fives',
        '6': 'sixes',
        '7': 'sevens',
        '8': 'eights',
        '9': 'nines',
        'T': 'tens',
        'J': 'jacks',
        'Q': 'queens',
        'K': 'kings',
    };

    const sortHand = (hand: string[]) => {
        hand.sort();
        for(let i = 0; i < hand.length; i++) {
            if(hand[i][0] === 'A') {
                const temp = hand[i];
                hand.splice(i, 1);
                hand.unshift(temp);
            }
        }
    }

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        switch(msg.type) {
            case 'logged_in':
                sessionID = msg.sessionID;
                username = msg.username;
                loginedIn = true;
                page = 'main_menu';
                break;
            case 'username_taken':
                loginErrorMessage = 'Username already taken.';
                break;
            case 'already_logged_in':
                loginErrorMessage = 'Account already logged in.';
                break;
            case 'account_dne':
                loginErrorMessage = 'Account does not exist.';
                break;
            case 'wrong_password':
                loginErrorMessage = 'Incorrect password.';
                break;
            case 'lobby_joined':
                page = 'lobby';
                break;
            case 'lobby_left':
                page = 'main_menu';
                break;
            case 'lobby_player_counts':
                lobbyPlayerCounts = msg.counts;
                break;
            case 'lobby_data':
                lobbyData = msg.data;
                break;
            case 'game_start':
                console.log('game starting');
                gameStarted = true;
                playing = msg.playing;
                game = msg.game;
                page = game;
                break;
            case 'game_end':
                console.log('game ended');
                gameStarted = false;
                playing = false;
                gameEndReason = msg.reason;
                gameEndUser = msg.username;
                page = 'game_end';
                break;
            case 'new_turn':
                gameDisplayText = '';
                currentTurnName = msg.username;
                canDraw = false;
                canAsk = currentTurnName === username;
                break;
            case 'player_count':
                playerCount = msg.count;
                break;
            case 'top_card':
                topCard = msg.card;
                break;
            case 'remove_card':
                hand = hand.filter(c => c !== msg.card);
                break;
            case 'add_card':
                hand = [...hand, msg.card];
                sortHand(hand);
                break;
            case 'remove_card':
                hand = hand.filter(c => c !== msg.card);
                break;
            case 'add_book':
                books = [...books, msg.value];
                break;
            case 'go_fish_fail':
                gameDisplayText = `${msg.username} had no ${rankWords[msg.value]}. Go fish.`;
                canAsk = false;
                canDraw = true;
                break;
            case 'go_fish_succeed':
                gameDisplayText = `${msg.username} had ${msg.count} ${rankWords[msg.value]}.`;
                console.log(gameDisplayText);
                break;
            case 'add_money':
                money += msg.amount;
                break;
            case 'pot':
                pot = msg.amount;
                break;
            case 'small_blind':
                smallBlind = true;
                break;
            case 'big_blind':
                bigBlind = true;
                break;
        }
    };
</script>

{#if !loginedIn}
    <LoginPage 
        {ws}
        {loginErrorMessage}
    />
{:else if page === 'main_menu'}
    <MainMenuPage
        callback={(val) => page = val}
    />
{:else if page === 'official_lobbies'}
    <OfficialLobbiesPage 
        {ws}
        {sessionID}
        {lobbyPlayerCounts}
    />
{:else if page === 'lobby'}
    <LobbyPage 
        {ws}
        {sessionID}
        {username}
        {lobbyData}
    />
{:else if page === 'crazy_eights'}
    <CrazyEightsPage
        {ws} 
        {sessionID}
        {username}
        {lobbyData}
        {playing}
        {hand}
        {currentTurnName}
        {topCard}
    />
{:else if page === 'go_fish'}
    <GoFishPage 
        {ws} 
        {sessionID}
        {username}
        {lobbyData}
        {playing}
        {canAsk}
        {canDraw}
        {hand}
        {currentTurnName}
        {books}
        {gameDisplayText}
    />
{:else if page === 'texas_holdem'}
    <TexasHoldemPage
        {ws} 
        {sessionID}
        {username}
        {lobbyData}
        {playing}
        {hand}
        {money}
        {smallBlind}
        {bigBlind}
        {pot}
        {currentTurnName}
    />
{:else if page === 'game_end'}
    <GameEndPage
        {gameEndReason}
        {gameEndUser}
        {username}
        callback={() => {
            page = 'lobby';
        }}
    />
{/if}

<style>
</style>
