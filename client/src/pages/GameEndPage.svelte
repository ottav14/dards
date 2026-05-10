<script lang="ts">
    export let gameEndReason: string;
    export let gameEndUser: string;
    export let username: string;
    export let callback: () => void;
    let explanatoryText = '';

    $: {
        switch(gameEndReason) {
            case 'too_few_players':
                explanatoryText = `${gameEndUser} has left.
                The game has ended.`;
                break;
            case 'won':
                if(gameEndUser === username)
                    explanatoryText = `You won!`;
                else
                    explanatoryText = `${gameEndUser} won. You lost.`;
                break;
        }
    }
</script>

<div>
    {explanatoryText}
    <button on:click={callback}>
        Return to lobby
    </button>
</div>

<style>
    div {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100vh;
    }

    button {
        margin-top: 2rem;
        padding: 1rem;
    }
</style>
