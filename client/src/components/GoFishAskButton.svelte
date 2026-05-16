<script lang="ts">

    export let sessionID: string;
    export let ws: WebSocket;
    export let playerName: string;
    export let canAsk: boolean;
    export let hand: string[];

    let open = false;
    const cardValues = [ 'A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K' ];

    const hasValue = (value: string) => {
        for(const card of hand) {
            if(card[0] === value)
                return true;
        }
        return false;
    }

    const ask = (val: string) => {
        open = false;
        ws.send(JSON.stringify({
            type: 'go_fish_ask',
            val: val,
            askName: playerName,
            sessionID: sessionID
        }));
    }
</script>

<div class="askButtonContainer">
    <button 
        disabled={!canAsk}
        class="askButton"
        on:click={() => {
            open = !open;
        }}
     >
        Ask
    </button>
    {#if open}
        <div class="menu">
            {#each cardValues as val}
                {#if hasValue(val)}
                    <button
                        class="cardButton"
                        on:click={() => ask(val)}
                    >
                        {val}
                    </button>
                {/if}
            {/each}
        </div>
    {/if}
</div>

<style>
    .askButtonContainer {
        position: relative;
    }

    .menu {
        display: flex;
        flex-direction: column;
        width: 5rem;
        position: absolute;
        top: 0;
        left: 100%;
        background: #e9e9e9;
        z-index: 1;
    }
</style>
