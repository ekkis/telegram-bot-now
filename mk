#!/bin/bash

#
#	Synopsis
#	   This is a small collection of tools to help manage and
#      test `now` deployments
#	Author
#      Erick Calder <e@arix.com>
#	Notes
#      For information on usage please refer to the Medium article:
#      https://medium.com/@ekkis/building-a-telegram-bot-in-node-js-now-6daea82ca425
#

help() {
	cat <<- "EOF"
	mk [-d] [command]

	where <command> may be:

	   logs - shows deployment logs for your project
	   msg [-] <command> <chat_id> <from> - sends a message to your server
	   bind - binds your server to the Telegram bot using web hooks
	   bind info - shows binding information
	   bind rm - removes the existing binding
	   clearqueue - useful to wipe out messages stuck in the queue
	   secret <key> <value> - installs a secret (appends to the .env)
	   secrets - install all secrets in your .env file
	   scaffold - creates a skeleton bot in your project directory

	To see the actual statements issued by this script when running
	a command prefix the command with -d:

	   $ mk -d bind

	To build a deployment just run this script without arguments:

	   $ mk

	-- messaging --

	For development you can run your bot using `npm start`.  You can send
	messages to it from the command line like this:

		$ mk msg -l "/ping" 2034492 "JohnDoe"	# local
	
	After deployment (hosted on Now) you can message the bot with `-b`:
	
		$ mk msg -b "/ping" 2034492 "JohnDoe"	# deployed

	You can also message Telegram directly.  Hers's how:

		$ mk msg -t "/ping" 2034492 "JohnDoe"	# Telegram

	and for testing the sending of images, supply a valid file id via the
	environment variable shown, and pass the -p parameter:

		$ export TELEGRAM_BOT_IMAGE="AgADAQADaqgxGyX5yETF2DyyOFrdN_9sDDAABO6I-45utcxCSBoEAAEC"
		$ mk msg -b "/ping" 2034492 "JohnDoe" -p

	-- environment --

	To be compatible with the VSCode debugger, environment files cannot include the EXPORT
	statement, without which subshells cannot see the values.  The command below thus allows
	you to initialise your environment from one of these files:

		$ eval "$(mk env)"

	but if you just run `mk env` it will remind you of the above syntax

	You can also create all the secrets needed for your deployment from said file by running
	the following command:

		$ mk secrets

	The script will also indicate any secrets required by your deployment that are missing
	from your environment file

	-- examples --

	To show current bindings:

		$ mk bind info

	To set a secret with credentials for your database:

	   $ mk secret "DATABASE_AUTH" "JohnDoe:SomePassword"

	You can then check that the secret was also added to the environment file:

		$ cat .env
	EOF
	exit 0
}

msg() {
	srv=$1; cmd=$2; chat_id=$3; from=$4; type=$5; args=$6
	[ "$type" == "-p" -a "$TELEGRAM_BOT_IMAGE" == "" ] && {
		echo "No Telegram bot image ID available"
		exit 1
	}

	d=$(msg_data $srv $chat_id $from "$cmd" $type "$args")
	if [ "$srv" == "-t" ]; then
		[ "$type" == "-p" ] && method="sendPhoto" || method="sendMessage"
		fetch $method $srv -d "'$d'" $(hdr -j)
	else
		bot="?bot=$TELEGRAM_BOT_USERNAME"
		fetch $bot $srv -d "'$d'" $(hdr -j)
	fi
}

bind() {
	[ "$1" == "rm" ] && {
		fetch "/deleteWebhook" -t; return
	}
	[ "$1" == "info" ] && {
		fetch "/getWebhookInfo" -t; return
	}
	[ -z "$1" ] && {
		echo "No bot name specified for the binding!"
		exit 1
	}
	#d='{"url": "%s", "allowed_updates": ["message", "channel_post"]}'
	d=$(printf '{"url": "%s"}' "$(cat .url)/server.js?bot=$1")
	fetch "/setWebhook" -t -d "'$d'" $(hdr -j)
}

clearqueue() {
	bind rm
	id=$(fetch "/getUpdates" -t 2>/dev/null |jq .result[-1].update_id)
	id=$(echo "$id+1" |bc)
	fetch "/getUpdates" -t "-F 'offset=$id'"
	bind $TELEGRAM_BOT_USERNAME
}

secret() {
	key=$1; val=$2
	now secret add "$key" "$val"
	[ $? -eq 0 ] && {
		key=$(echo $key| sed 's/-/_/g' |awk '{print toupper($0)}')
		echo "$key=$val" >> .env
	}
}

secrets() {
	script=$(cat <<- EOF
	const fs = require('fs')
	const jsp = require('js-prototype-lib')
	jsp.install('string', 'object')
	const now = require('./now.json').env;
	const env = fs.readFileSync('./.env', 'utf8')
		.replace(/^export\s+/gm, '')
		.keyval()
	var val = env.map((self, k, acc) => {
		if (now[k] && env[k]) {
			acc[now[k].replace(/^@/, '')] = env[k].q('')
		}   
	})

	var rm = val.keys().map(k => 'echo Y | now secret rm ' + k)
		.join('\n')
	var add = val.keyval({ks: ' '}) 
		.replace(/^/gm, 'now secret add ')
	var missing = now.notIn(env);

	console.log(rm)
	console.log(add)
	console.log("echo -e '\n* Environment set up (" + val.keys().length + " keys installed)'")
	if (missing.length > 0) {
		console.log("echo '\nThe following keys are missing from your environment'")
		console.log("echo 'file for your deployment to work:'")
		console.log("echo '\n  * " + missing.join('\n  * ') + "\n'")
	}
	EOF
	)
	script=$(node -e "$script")
	[ -z "$NOEXEC" ] && eval "$script" || echo "$script"
}

scaffold() {
	d=node_modules/telegram-bot-now/scaffold
	cp -r $d/ . > /dev/null

	echo "The following files have been created in your project root:"
	echo " - server.js"
	echo " - now.json"
	echo " - .env"
}

env() {
	[ ! -f .env ] && {
		echo "No environment file available!"
		exit 1
	}
	echo '#'
	echo '# run like this: eval "$(mk env)"'
	echo '#'
	cat .env |grep -ve '^\s*$' |sed 's/^/export /'
}

logs() {
	msg="Cannot show logs.  No deployment has been made"
	[ ! -f .url ] && {
		echo $msg; exit 0
	}
	url=$(cat .url)
	[ -z "$url" ] && {
		echo $msg; exit 0
	}
	now logs -n ${1:-200} -f $url
}

# --- support functionatlity --------------------------------------------------

url() {
	[ "$1" == "-b" ] && {
		echo "$(cat .url)/server.js"
	}
	[ "$1" == "-l" ] && {
		echo "http://localhost:3000/server.js"
	}
	[ "$1" == "-t" ] && {
		[ -z "$TELEGRAM_BOT_KEY" ] && {
			echo "Telegram API not set.  Please set the value in your local environment with:" > /dev/stderr
			echo "export TELEGRAM_BOT_KEY=xxxxxxxx" > /dev/stderr
			exit 1
		}
		echo "https://api.telegram.org/bot${TELEGRAM_BOT_KEY}"
	}
}

hdr() {
	[[ "$1" == "-j" ]] && {
		echo -H "Content-Type:application/json"
	}
}

fetch() {
	srv=$1; cmd=""; shift
	# server is optional
	[[ "$srv" != -* ]] && {
		cmd=$srv; srv=$1; shift
	}
	url="curl $@ $(url $srv)"
	[ ! -z "$cmd" ] && url="$url$cmd"
	[ "$DEBUG" == "Y" ] && echo $url > /dev/stderr
	eval $url
	echo ""
}

msg_data() {
	srv=$1; chat_id=$2; from=$3; cmd=$4; type=$5; args=$6
	
	if [ "$type" == "-p" ]
	then
		if [ "$srv" == "-t" ]; then
			printf "$(msg_photoToTel)" $chat_id
		else
			printf "$(msg_photoToBot)" $chat_id $from
		fi
	elif [ "$type" == "-k" ]
	then
		printf "$(msg_keyboardToTel)" $chat_id "$args"
	else
		f=$([ "$srv" == "-t" ] && msg_textToTel || msg_textToBot)
		printf "$f" $chat_id $from "$cmd"
	fi
}

msg_textToTel() {
    cat <<- EOF
	{
		"chat_id": "%s",
		"chat_type": "private",
		"username": "%s",
		"parse_mode": "Markdown",
		"text": "%s"
	}
	EOF
}

msg_textToBot() {
	cat <<- EOF
	{ "message": {
		"chat": {"id": "%s", "type": "private"},
		"from": {"username": "%s"},
		"text": "%s"
	}}
	EOF
}

msg_photoToTel() {
	cat <<- EOF 
	{   
		"chat_id": "%s",
		"photo": "$TELEGRAM_BOT_IMAGE"
	}   
	EOF
}

msg_photoToBot() {
	cat <<- EOF 
	{ "message": {  
		"chat": {
			"id": "%s",
			"type": "private"
		},
		"from": {"username": "%s"},
		"photo": [{
			"file_id": "$TELEGRAM_BOT_IMAGE",
			"file_size": "857",
			"width": "90", 
			"height": "15"
		}]
	}}
	EOF
}

msg_keyboardToTel() {
	cat <<- EOF
	{
		"chat_id": "%s",
		"text": "xx",
		"reply_markup": {
			"keyboard": [%s],
			"one_time_keyboard": true,
			"resize_keyboard": true,
			"selective": false
		}
	}
	EOF
}

# --- main() ------------------------------------------------------------------

[ "$1" == "-d" ] && {
	shift; DEBUG=Y; set -x
}
[ "$1" == "--help" ] && {
	help
}
[ ! -z "$1" ] && {
	"$@"; exit
}

[ -f .url ] && url=$(cat .url)
[ ! -z "$url" ] && now rm --yes $url
now > .url
