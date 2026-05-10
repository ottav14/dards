<script lang="ts">
    import CrazyEightsPage from './pages/CrazyEightsPage.svelte';
    import GoFishPage from './pages/GoFishPage.svelte';
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
    let currentTurnName: string = '';
    let topCard = '';
    let page = 'login';
    let lobbyPlayerCounts: number[];
    let loginErrorMessage = '';
    let gameEndReason = '';
    let gameEndUser = '';
    let books: string[] = [];

    const ws = new WebSocket("ws://localhost:5173/ws");
    let uuid: string = '';
    let username: string = '';
    let lobbyData: any[];

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        switch(msg.type) {
            case 'logged_in':
                console.log('logged in');
                uuid = msg.uuid;
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
            case 'lobby_player_counts':
                lobbyPlayerCounts = msg.counts;
                console.log(lobbyPlayerCounts);
                break;
            case 'lobby_data':
                console.log(msg.data);
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
                currentTurnName = msg.username;
                break;
            case 'player_count':
                playerCount = msg.count;
                break;
            case 'top_card':
                topCard = msg.card;
                break;
            case 'remove_card':
                for(let i = 0; i < hand.length; i++) {
                    if(hand[i] === msg.card) {
                        hand = hand.filter((_, j) => j != i);
                        break;
                    }
                }
                break;
            case 'add_card':
                hand = [...hand, msg.card];
                break;
            case 'remove_card':
                hand = hand.filter(c => c !== msg.card);
                break;
            case 'add_book':
                books.push(msg.value);
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
        {uuid}
        {lobbyPlayerCounts}
    />
{:else if page === 'lobby'}
    <LobbyPage 
        {ws}
        {uuid}
        {username}
        {lobbyData}
    />
{:else if page === 'crazy_eights'}
    <CrazyEightsPage
        {ws} 
        {uuid}
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
        {uuid}
        {username}
        {lobbyData}
        {playing}
        {hand}
        {currentTurnName}
        {topCard}
        {books}
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
