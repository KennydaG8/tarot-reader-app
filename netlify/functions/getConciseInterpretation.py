import json
import os
import anthropic

# 從環境變數獲取 API 金鑰 (在 Netlify 設定)
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY')
CLAUDE_MODEL_CONCISE = "claude-3-5-sonnet-latest" # 或者從 config 讀取
MAX_TOKENS_CONCISE = 500 # 或者從 config 讀取

def handler(event, context):
    if not ANTHROPIC_API_KEY:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "API key not configured on server."})
        }

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    try:
        if event.get("httpMethod") != "POST":
            return {
                "statusCode": 405,
                "body": json.dumps({"error": "Method Not Allowed"})
            }

        body = json.loads(event.get("body", "{}"))
        topic = body.get("topic")
        question = body.get("question")
        drawn_cards = body.get("drawn_cards") # Expecting list of card objects

        if not topic or not question or not drawn_cards or len(drawn_cards) != 3:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Missing required fields: topic, question, or drawn_cards (must be 3)."})
            }

        # System prompt for concise interpretation
        system_prompt = "你是一位洞悉星辰密語的塔羅占卜師。請連結宇宙的智慧，根據使用者抽出的三張牌陣，針對其問題，給予一段**簡潔明瞭、一針見血的核心解讀**。點出最關鍵的影響、狀態和可能性即可。"

        user_prompt_details = f"探尋領域：「{topic}」\n提問：「{question}」\n\n星盤位置與神諭牌卡：\n\n"
        position_labels = ["往昔之影 (過去/背景)", "當下之核 (現在/核心)", "未來之徑 (未來/結果)"] # Keep this consistent

        for i, card in enumerate(drawn_cards):
            position = position_labels[i]
            orientation = '逆位' if card.get('isReversed', False) else '正位'
            # Frontend now sends selected keywords directly
            keywords_list = card.get('keywords', [])
            card_name = card.get('name', '未知卡牌')

            user_prompt_details += f"星位 {i + 1}: {position}\n"
            user_prompt_details += f"牌卡: {card_name} ({orientation})\n"
            user_prompt_details += f"關鍵詞: {', '.join(keywords_list)}\n\n"


        message = client.messages.create(
            model=CLAUDE_MODEL_CONCISE,
            max_tokens=MAX_TOKENS_CONCISE,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt_details}]
        )

        interpretation = message.content[0].text if message.content else "抱歉，無法生成初步解讀。"

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"interpretation": interpretation})
        }

    except json.JSONDecodeError:
        return {"statusCode": 400, "body": json.dumps({"error": "Invalid JSON in request body."})}
    except anthropic.APIError as e:
        print(f"Anthropic API Error: {e}")
        return {"statusCode": 500, "body": json.dumps({"error": f"Claude API Error: {str(e)}"})}
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": f"An unexpected server error occurred: {str(e)}"})
        }