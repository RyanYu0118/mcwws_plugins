function onUse(event) {

    var player = event.getPlayer();

    var inv = player.getInventory();

    var itemInMainHand = inv.getItemInMainHand();
    var itemInOffHand = inv.getItemInOffHand();

    var numMHI = itemInMainHand.getAmount();
    var numOHI = itemInOffHand.getAmount();

    var playerSaturation = player.getSaturation();
    var playerFoodLevel = player.getFoodLevel();

    if (numMHI > 0) {
        var MHIname = itemInMainHand.getItemMeta().getDisplayName();
        var MHSaturation = itemInMainHand.getItemMeta().getFood().getSaturation();
        var MHFoodLevel = itemInMainHand.getItemMeta().getFood().getNutrition();

        if (MHIname == "§x§F§8§3§1§2§F🥫 番茄酱") {
            if (numOHI == 0) {
                //独主
                //禁用命令反馈
                runConsoleCommand("gamerule sendCommandFeedback false");
                //更新主手物品
                runOpCommand(player, "execute store result score %player_name% mcwws.data.selecteditem.remain run data get entity %player_name% SelectedItem.components.minecraft:custom_data.PublicBukkitValues.Remain");
                runOpCommand(player, `execute unless score %player_name% mcwws.data.selecteditem.remain matches 1 run minecraft:item replace entity %player_name% weapon.mainhand with minecraft:player_head[custom_data={PublicBukkitValues:{Remain:%math_0_{objective_score_mcwws.data.selecteditem.remain}-1%, "slimefun:slimefun_item": "MCWWS_KETCHUP"}}, lore=['{"extra":[{"bold":false,"color":"yellow","italic":false,"obfuscated":false,"strikethrough":false,"text":"","underlined":false}],"text":""}', '{"extra":[{"bold":false,"color":"green","italic":false,"obfuscated":false,"strikethrough":false,"text":"🍗 单次回复 ","underlined":false},{"color":"aqua","italic":false,"text":"2 "},{"color":"green","italic":false,"text":"饥饿值"}],"text":""}', '{"extra":[{"bold":false,"color":"green","italic":false,"obfuscated":false,"strikethrough":false,"text":"🍗 与","underlined":false},{"color":"green","italic":false,"text":"特定食物/饮品","underlined":true},{"color":"green","italic":false,"text":"搭配额外恢复 ","underlined":false},{"color":"aqua","italic":false,"text":"1 "},{"color":"green","italic":false,"text":"饥饿值 "},{"color":"dark_gray","italic":false,"text":"📘🔍"}],"text":""}', '{"extra":[{"bold":false,"color":"green","italic":false,"obfuscated":false,"strikethrough":false,"text":"☕ 增加 ","underlined":false},{"color":"aqua","italic":false,"text":"3 "},{"color":"green","italic":false,"text":"饱和度"}],"text":""}', '{"extra":[{"bold":false,"color":"#E066A2","italic":false,"obfuscated":false,"strikethrough":false,"text":"🫧 赋予/消除 ","underlined":false},{"bold":false,"color":"#E066DF","italic":false,"obfuscated":false,"strikethrough":false,"text":"状态效果","underlined":true},{"bold":false,"italic":false,"obfuscated":false,"strikethrough":false,"text":" ","underlined":false},{"color":"dark_gray","italic":false,"text":"📘🔍"}],"text":""}', '{"extra":[{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"🧪 剩余 ","underlined":false},{"bold":false,"color":"#BFDD52","italic":false,"obfuscated":false,"strikethrough":false,"text":"%math_0_{objective_score_mcwws.data.selecteditem.remain}-1%","underlined":false},{"bold":false,"color":"dark_gray","italic":false,"obfuscated":false,"strikethrough":false,"text":"/32 ","underlined":false},{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"次使用","underlined":false}],"text":""}', '{"extra":[{"bold":false,"color":"yellow","italic":false,"obfuscated":false,"strikethrough":false,"text":"","underlined":false}],"text":""}', '{"extra":[{"bold":false,"color":"gray","italic":false,"obfuscated":false,"strikethrough":false,"text":"🔒 已授权","underlined":false},{"color":"gray","italic":false,"obfuscated":true,"text":"ﷲ"}],"text":""}', '{"extra":[{"bold":false,"color":"red","italic":false,"obfuscated":false,"strikethrough":false,"text":"🚫🫳 不可放置","underlined":false},{"color":"red","italic":false,"obfuscated":true,"text":"ﷲ"}],"text":""}', '{"extra":[{"bold":false,"color":"red","italic":false,"obfuscated":false,"strikethrough":false,"text":"🚫📚 不可堆叠","underlined":false},{"color":"red","italic":false,"obfuscated":true,"text":"ﷲ"}],"text":""}', '{"extra":[{"bold":false,"color":"yellow","italic":false,"obfuscated":false,"strikethrough":false,"text":"消耗性商品","underlined":false}],"text":""}'], food={can_always_eat:true, nutrition:2, saturation:3}, custom_name='{"text":"","extra":[{"text":"🥫 番茄酱","obfuscated":false,"italic":false,"underlined":false,"strikethrough":false,"color":"#F8312F","bold":false}]}', profile={id:[I;-1379669389,1531072490,-1573434766,-1255286997],name:"",properties:[{name:"textures",value:"eyJ0ZXh0dXJlcyI6eyJTS0lOIjp7InVybCI6Imh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvYzBiOGI1ODg5ZWUxYzYzODhkYzZjMmM1ZGJkNzBiNjk4NGFlZmU1NDMxOWEwOTVlNjRkYjc2MzgwOTdiODIxIn19fQ=="}]}, max_stack_size=1]`);
                runOpCommand(player, "execute if score %player_name% mcwws.data.selecteditem.remain matches 1 run minecraft:item replace entity %player_name% weapon.mainhand with minecraft:air");
                //清除状态效果
                runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:poison");
                runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:hunger");
                runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:slowness");
                runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:mining_fatigue");
                runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:nausea");
                runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:blindness");
                runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:darkness");
                //给予状态效果
                runOpCommand(player, "execute as %player_name% run effect give %player_name% minecraft:instant_health");
                runOpCommand(player, "execute as %player_name% run effect give %player_name% minecraft:resistance 300 1");
                runOpCommand(player, "execute as %player_name% run effect give %player_name% minecraft:night_vision 300");
                //给予玩家饥饿值和饱和度
                void player.setFoodLevel(MHFoodLevel + playerFoodLevel);
                void player.setSaturation(MHSaturation + playerSaturation);
                //主手物品剩余信息提示
                runOpCommand(player, `execute unless score %player_name% mcwws.data.selecteditem.remain matches 1 run minecraft:title %player_name% actionbar [{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"🧪 剩余 ","underlined":false},{"bold":false,"color":"#BFDD52","italic":false,"obfuscated":false,"strikethrough":false,"text":"%math_0_{objective_score_mcwws.data.selecteditem.remain}-1%","underlined":false},{"bold":false,"color":"dark_gray","italic":false,"obfuscated":false,"strikethrough":false,"text":"/32 ","underlined":false},{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"次使用","underlined":false}]`);
                runOpCommand(player, `execute if score %player_name% mcwws.data.selecteditem.remain matches 1 run minecraft:title %player_name% actionbar [{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"🧪 已耗尽","underlined":false}]`);
                //更新主手物品数据
                runOpCommand(player, "execute unless score %player_name% mcwws.data.selecteditem.remain matches 1 store result score %player_name% mcwws.data.selecteditem.remain run data get entity %player_name% SelectedItem.components.minecraft:custom_data.PublicBukkitValues.Remain");
                runOpCommand(player, "execute if score %player_name% mcwws.data.selecteditem.remain matches 1 run scoreboard players set %player_name% mcwws.data.selecteditem.remain 0");
                //播放音效
                runOpCommand(player, "playsound minecraft:item.honey_bottle.drink player %player_name% ~ ~ ~ 1 1 1");
                //恢复命令反馈
                runConsoleCommand("gamerule sendCommandFeedback true");
            }
            else {
                var OHIname = itemInOffHand.getItemMeta().getDisplayName();
                var OHSaturation = itemInOffHand.getItemMeta().getFood().getSaturation();
                var OHFoodLevel = itemInOffHand.getItemMeta().getFood().getNutrition();
                if (OHIname == "§x§F§8§3§1§2§F🥫 番茄酱") {
                    //禁用命令反馈
                    runConsoleCommand("gamerule sendCommandFeedback false");
                    sendMessage(player, "&c啊哦，你似乎在纠结到底吃左手的番茄酱呢，还是吃右手的番茄酱捏......");
                    runOpCommand(player, "playsound minecraft:enchant.thorns.hit player %player_name% ~ ~ ~ 1 1 1");
                    //恢复命令反馈
                    runConsoleCommand("gamerule sendCommandFeedback true");
                }
                else {
                    if (OHIname == "§e🍟 薯条") {
                        //多主
                        //禁用命令反馈
                        runConsoleCommand("gamerule sendCommandFeedback false");
                        //更新主手物品
                        runOpCommand(player, "execute store result score %player_name% mcwws.data.selecteditem.remain run data get entity %player_name% SelectedItem.components.minecraft:custom_data.PublicBukkitValues.Remain");
                        runOpCommand(player, `execute unless score %player_name% mcwws.data.selecteditem.remain matches 1 run minecraft:item replace entity %player_name% weapon.mainhand with minecraft:player_head[custom_data={PublicBukkitValues:{Remain:%math_0_{objective_score_mcwws.data.selecteditem.remain}-1%, "slimefun:slimefun_item": "MCWWS_KETCHUP"}}, lore=['{"extra":[{"bold":false,"color":"yellow","italic":false,"obfuscated":false,"strikethrough":false,"text":"","underlined":false}],"text":""}', '{"extra":[{"bold":false,"color":"green","italic":false,"obfuscated":false,"strikethrough":false,"text":"🍗 单次回复 ","underlined":false},{"color":"aqua","italic":false,"text":"2 "},{"color":"green","italic":false,"text":"饥饿值"}],"text":""}', '{"extra":[{"bold":false,"color":"green","italic":false,"obfuscated":false,"strikethrough":false,"text":"🍗 与","underlined":false},{"color":"green","italic":false,"text":"特定食物/饮品","underlined":true},{"color":"green","italic":false,"text":"搭配额外恢复 ","underlined":false},{"color":"aqua","italic":false,"text":"1 "},{"color":"green","italic":false,"text":"饥饿值 "},{"color":"dark_gray","italic":false,"text":"📘🔍"}],"text":""}', '{"extra":[{"bold":false,"color":"green","italic":false,"obfuscated":false,"strikethrough":false,"text":"☕ 增加 ","underlined":false},{"color":"aqua","italic":false,"text":"3 "},{"color":"green","italic":false,"text":"饱和度"}],"text":""}', '{"extra":[{"bold":false,"color":"#E066A2","italic":false,"obfuscated":false,"strikethrough":false,"text":"🫧 赋予/消除 ","underlined":false},{"bold":false,"color":"#E066DF","italic":false,"obfuscated":false,"strikethrough":false,"text":"状态效果","underlined":true},{"bold":false,"italic":false,"obfuscated":false,"strikethrough":false,"text":" ","underlined":false},{"color":"dark_gray","italic":false,"text":"📘🔍"}],"text":""}', '{"extra":[{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"🧪 剩余 ","underlined":false},{"bold":false,"color":"#BFDD52","italic":false,"obfuscated":false,"strikethrough":false,"text":"%math_0_{objective_score_mcwws.data.selecteditem.remain}-1%","underlined":false},{"bold":false,"color":"dark_gray","italic":false,"obfuscated":false,"strikethrough":false,"text":"/32 ","underlined":false},{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"次使用","underlined":false}],"text":""}', '{"extra":[{"bold":false,"color":"yellow","italic":false,"obfuscated":false,"strikethrough":false,"text":"","underlined":false}],"text":""}', '{"extra":[{"bold":false,"color":"gray","italic":false,"obfuscated":false,"strikethrough":false,"text":"🔒 已授权","underlined":false},{"color":"gray","italic":false,"obfuscated":true,"text":"ﷲ"}],"text":""}', '{"extra":[{"bold":false,"color":"red","italic":false,"obfuscated":false,"strikethrough":false,"text":"🚫🫳 不可放置","underlined":false},{"color":"red","italic":false,"obfuscated":true,"text":"ﷲ"}],"text":""}', '{"extra":[{"bold":false,"color":"red","italic":false,"obfuscated":false,"strikethrough":false,"text":"🚫📚 不可堆叠","underlined":false},{"color":"red","italic":false,"obfuscated":true,"text":"ﷲ"}],"text":""}', '{"extra":[{"bold":false,"color":"yellow","italic":false,"obfuscated":false,"strikethrough":false,"text":"消耗性商品","underlined":false}],"text":""}'], food={can_always_eat:true, nutrition:2, saturation:3}, custom_name='{"text":"","extra":[{"text":"🥫 番茄酱","obfuscated":false,"italic":false,"underlined":false,"strikethrough":false,"color":"#F8312F","bold":false}]}', profile={id:[I;-1379669389,1531072490,-1573434766,-1255286997],name:"",properties:[{name:"textures",value:"eyJ0ZXh0dXJlcyI6eyJTS0lOIjp7InVybCI6Imh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvYzBiOGI1ODg5ZWUxYzYzODhkYzZjMmM1ZGJkNzBiNjk4NGFlZmU1NDMxOWEwOTVlNjRkYjc2MzgwOTdiODIxIn19fQ=="}]}, max_stack_size=1]`);
                        runOpCommand(player, "execute if score %player_name% mcwws.data.selecteditem.remain matches 1 run minecraft:item replace entity %player_name% weapon.mainhand with minecraft:air");
                        //消除副手物品
                        void itemInOffHand.setAmount(numOHI - 1);
                        //清除状态效果
                        runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:poison");
                        runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:hunger");
                        runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:slowness");
                        runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:mining_fatigue");
                        runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:nausea");
                        runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:blindness");
                        runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:darkness");
                        //给予状态效果
                        runOpCommand(player, "execute as %player_name% run effect give %player_name% minecraft:instant_health");
                        runOpCommand(player, "execute as %player_name% run effect give %player_name% minecraft:resistance 300 1");
                        runOpCommand(player, "execute as %player_name% run effect give %player_name% minecraft:night_vision 300");
                        //给予玩家饥饿值和饱和度
                        void player.setFoodLevel(MHFoodLevel + OHFoodLevel + playerFoodLevel);
                        void player.setSaturation(MHSaturation + OHSaturation + playerSaturation);
                        //主手物品剩余信息提示
                        runOpCommand(player, `execute unless score %player_name% mcwws.data.selecteditem.remain matches 1 run minecraft:title %player_name% actionbar [{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"🧪 剩余 ","underlined":false},{"bold":false,"color":"#BFDD52","italic":false,"obfuscated":false,"strikethrough":false,"text":"%math_0_{objective_score_mcwws.data.selecteditem.remain}-1%","underlined":false},{"bold":false,"color":"dark_gray","italic":false,"obfuscated":false,"strikethrough":false,"text":"/32 ","underlined":false},{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"次使用","underlined":false}]`);
                        runOpCommand(player, `execute if score %player_name% mcwws.data.selecteditem.remain matches 1 run minecraft:title %player_name% actionbar [{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"🧪 已耗尽","underlined":false}]`);
                        //更新主手物品数据
                        runOpCommand(player, "execute unless score %player_name% mcwws.data.selecteditem.remain matches 1 store result score %player_name% mcwws.data.selecteditem.remain run data get entity %player_name% SelectedItem.components.minecraft:custom_data.PublicBukkitValues.Remain");
                        runOpCommand(player, "execute if score %player_name% mcwws.data.selecteditem.remain matches 1 run scoreboard players set %player_name% mcwws.data.selecteditem.remain 0");
                        //播放音效
                        runOpCommand(player, "playsound minecraft:item.honey_bottle.drink player %player_name% ~ ~ ~ 1 1 1");
                        //恢复命令反馈
                        runConsoleCommand("gamerule sendCommandFeedback true");
                    }
                    else {
                        //独主
                        //禁用命令反馈
                        runConsoleCommand("gamerule sendCommandFeedback false");
                        //更新主手物品
                        runOpCommand(player, "execute store result score %player_name% mcwws.data.selecteditem.remain run data get entity %player_name% SelectedItem.components.minecraft:custom_data.PublicBukkitValues.Remain");
                        runOpCommand(player, `execute unless score %player_name% mcwws.data.selecteditem.remain matches 1 run minecraft:item replace entity %player_name% weapon.mainhand with minecraft:player_head[custom_data={PublicBukkitValues:{Remain:%math_0_{objective_score_mcwws.data.selecteditem.remain}-1%, "slimefun:slimefun_item": "MCWWS_KETCHUP"}}, lore=['{"extra":[{"bold":false,"color":"yellow","italic":false,"obfuscated":false,"strikethrough":false,"text":"","underlined":false}],"text":""}', '{"extra":[{"bold":false,"color":"green","italic":false,"obfuscated":false,"strikethrough":false,"text":"🍗 单次回复 ","underlined":false},{"color":"aqua","italic":false,"text":"2 "},{"color":"green","italic":false,"text":"饥饿值"}],"text":""}', '{"extra":[{"bold":false,"color":"green","italic":false,"obfuscated":false,"strikethrough":false,"text":"🍗 与","underlined":false},{"color":"green","italic":false,"text":"特定食物/饮品","underlined":true},{"color":"green","italic":false,"text":"搭配额外恢复 ","underlined":false},{"color":"aqua","italic":false,"text":"1 "},{"color":"green","italic":false,"text":"饥饿值 "},{"color":"dark_gray","italic":false,"text":"📘🔍"}],"text":""}', '{"extra":[{"bold":false,"color":"green","italic":false,"obfuscated":false,"strikethrough":false,"text":"☕ 增加 ","underlined":false},{"color":"aqua","italic":false,"text":"3 "},{"color":"green","italic":false,"text":"饱和度"}],"text":""}', '{"extra":[{"bold":false,"color":"#E066A2","italic":false,"obfuscated":false,"strikethrough":false,"text":"🫧 赋予/消除 ","underlined":false},{"bold":false,"color":"#E066DF","italic":false,"obfuscated":false,"strikethrough":false,"text":"状态效果","underlined":true},{"bold":false,"italic":false,"obfuscated":false,"strikethrough":false,"text":" ","underlined":false},{"color":"dark_gray","italic":false,"text":"📘🔍"}],"text":""}', '{"extra":[{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"🧪 剩余 ","underlined":false},{"bold":false,"color":"#BFDD52","italic":false,"obfuscated":false,"strikethrough":false,"text":"%math_0_{objective_score_mcwws.data.selecteditem.remain}-1%","underlined":false},{"bold":false,"color":"dark_gray","italic":false,"obfuscated":false,"strikethrough":false,"text":"/32 ","underlined":false},{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"次使用","underlined":false}],"text":""}', '{"extra":[{"bold":false,"color":"yellow","italic":false,"obfuscated":false,"strikethrough":false,"text":"","underlined":false}],"text":""}', '{"extra":[{"bold":false,"color":"gray","italic":false,"obfuscated":false,"strikethrough":false,"text":"🔒 已授权","underlined":false},{"color":"gray","italic":false,"obfuscated":true,"text":"ﷲ"}],"text":""}', '{"extra":[{"bold":false,"color":"red","italic":false,"obfuscated":false,"strikethrough":false,"text":"🚫🫳 不可放置","underlined":false},{"color":"red","italic":false,"obfuscated":true,"text":"ﷲ"}],"text":""}', '{"extra":[{"bold":false,"color":"red","italic":false,"obfuscated":false,"strikethrough":false,"text":"🚫📚 不可堆叠","underlined":false},{"color":"red","italic":false,"obfuscated":true,"text":"ﷲ"}],"text":""}', '{"extra":[{"bold":false,"color":"yellow","italic":false,"obfuscated":false,"strikethrough":false,"text":"消耗性商品","underlined":false}],"text":""}'], food={can_always_eat:true, nutrition:2, saturation:3}, custom_name='{"text":"","extra":[{"text":"🥫 番茄酱","obfuscated":false,"italic":false,"underlined":false,"strikethrough":false,"color":"#F8312F","bold":false}]}', profile={id:[I;-1379669389,1531072490,-1573434766,-1255286997],name:"",properties:[{name:"textures",value:"eyJ0ZXh0dXJlcyI6eyJTS0lOIjp7InVybCI6Imh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvYzBiOGI1ODg5ZWUxYzYzODhkYzZjMmM1ZGJkNzBiNjk4NGFlZmU1NDMxOWEwOTVlNjRkYjc2MzgwOTdiODIxIn19fQ=="}]}, max_stack_size=1]`);
                        runOpCommand(player, "execute if score %player_name% mcwws.data.selecteditem.remain matches 1 run minecraft:item replace entity %player_name% weapon.mainhand with minecraft:air");
                        //清除状态效果
                        runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:poison");
                        runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:hunger");
                        runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:slowness");
                        runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:mining_fatigue");
                        runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:nausea");
                        runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:blindness");
                        runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:darkness");
                        //给予状态效果
                        runOpCommand(player, "execute as %player_name% run effect give %player_name% minecraft:instant_health");
                        runOpCommand(player, "execute as %player_name% run effect give %player_name% minecraft:resistance 300 1");
                        runOpCommand(player, "execute as %player_name% run effect give %player_name% minecraft:night_vision 300");
                        //给予玩家饥饿值和饱和度
                        void player.setFoodLevel(MHFoodLevel + playerFoodLevel);
                        void player.setSaturation(MHSaturation + playerSaturation);
                        //主手物品剩余信息提示
                        runOpCommand(player, `execute unless score %player_name% mcwws.data.selecteditem.remain matches 1 run minecraft:title %player_name% actionbar [{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"🧪 剩余 ","underlined":false},{"bold":false,"color":"#BFDD52","italic":false,"obfuscated":false,"strikethrough":false,"text":"%math_0_{objective_score_mcwws.data.selecteditem.remain}-1%","underlined":false},{"bold":false,"color":"dark_gray","italic":false,"obfuscated":false,"strikethrough":false,"text":"/32 ","underlined":false},{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"次使用","underlined":false}]`);
                        runOpCommand(player, `execute if score %player_name% mcwws.data.selecteditem.remain matches 1 run minecraft:title %player_name% actionbar [{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"🧪 已耗尽","underlined":false}]`);
                        //更新主手物品数据
                        runOpCommand(player, "execute unless score %player_name% mcwws.data.selecteditem.remain matches 1 store result score %player_name% mcwws.data.selecteditem.remain run data get entity %player_name% SelectedItem.components.minecraft:custom_data.PublicBukkitValues.Remain");
                        runOpCommand(player, "execute if score %player_name% mcwws.data.selecteditem.remain matches 1 run scoreboard players set %player_name% mcwws.data.selecteditem.remain 0");
                        //播放音效
                        runOpCommand(player, "playsound minecraft:item.honey_bottle.drink player %player_name% ~ ~ ~ 1 1 1");
                        //恢复命令反馈
                        runConsoleCommand("gamerule sendCommandFeedback true");
                    }
                }
            }
        }
        else {
            if (MHIname == "§e🍟 薯条") {
                var OHIname = itemInOffHand.getItemMeta().getDisplayName();
                var OHSaturation = itemInOffHand.getItemMeta().getFood().getSaturation();
                var OHFoodLevel = itemInOffHand.getItemMeta().getFood().getNutrition();
                //多副
                //禁用命令反馈
                runConsoleCommand("gamerule sendCommandFeedback false");
                //更新主手物品
                runOpCommand(player, "execute store result score %player_name% mcwws.data.offhand.remain run data get entity %player_name% Inventory[{Slot:-106b}].components.minecraft:custom_data.PublicBukkitValues.Remain");
                runOpCommand(player, `execute unless score %player_name% mcwws.data.offhand.remain matches 1 run minecraft:item replace entity %player_name% weapon.offhand with minecraft:player_head[custom_data={PublicBukkitValues:{Remain:%math_0_{objective_score_mcwws.data.offhand.remain}-1%, "slimefun:slimefun_item": "MCWWS_KETCHUP"}}, lore=['{"extra":[{"bold":false,"color":"yellow","italic":false,"obfuscated":false,"strikethrough":false,"text":"","underlined":false}],"text":""}', '{"extra":[{"bold":false,"color":"green","italic":false,"obfuscated":false,"strikethrough":false,"text":"🍗 单次回复 ","underlined":false},{"color":"aqua","italic":false,"text":"2 "},{"color":"green","italic":false,"text":"饥饿值"}],"text":""}', '{"extra":[{"bold":false,"color":"green","italic":false,"obfuscated":false,"strikethrough":false,"text":"🍗 与","underlined":false},{"color":"green","italic":false,"text":"特定食物/饮品","underlined":true},{"color":"green","italic":false,"text":"搭配额外恢复 ","underlined":false},{"color":"aqua","italic":false,"text":"1 "},{"color":"green","italic":false,"text":"饥饿值 "},{"color":"dark_gray","italic":false,"text":"📘🔍"}],"text":""}', '{"extra":[{"bold":false,"color":"green","italic":false,"obfuscated":false,"strikethrough":false,"text":"☕ 增加 ","underlined":false},{"color":"aqua","italic":false,"text":"3 "},{"color":"green","italic":false,"text":"饱和度"}],"text":""}', '{"extra":[{"bold":false,"color":"#E066A2","italic":false,"obfuscated":false,"strikethrough":false,"text":"🫧 赋予/消除 ","underlined":false},{"bold":false,"color":"#E066DF","italic":false,"obfuscated":false,"strikethrough":false,"text":"状态效果","underlined":true},{"bold":false,"italic":false,"obfuscated":false,"strikethrough":false,"text":" ","underlined":false},{"color":"dark_gray","italic":false,"text":"📘🔍"}],"text":""}', '{"extra":[{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"🧪 剩余 ","underlined":false},{"bold":false,"color":"#BFDD52","italic":false,"obfuscated":false,"strikethrough":false,"text":"%math_0_{objective_score_mcwws.data.offhand.remain}-1%","underlined":false},{"bold":false,"color":"dark_gray","italic":false,"obfuscated":false,"strikethrough":false,"text":"/32 ","underlined":false},{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"次使用","underlined":false}],"text":""}', '{"extra":[{"bold":false,"color":"yellow","italic":false,"obfuscated":false,"strikethrough":false,"text":"","underlined":false}],"text":""}', '{"extra":[{"bold":false,"color":"gray","italic":false,"obfuscated":false,"strikethrough":false,"text":"🔒 已授权","underlined":false},{"color":"gray","italic":false,"obfuscated":true,"text":"ﷲ"}],"text":""}', '{"extra":[{"bold":false,"color":"red","italic":false,"obfuscated":false,"strikethrough":false,"text":"🚫🫳 不可放置","underlined":false},{"color":"red","italic":false,"obfuscated":true,"text":"ﷲ"}],"text":""}', '{"extra":[{"bold":false,"color":"red","italic":false,"obfuscated":false,"strikethrough":false,"text":"🚫📚 不可堆叠","underlined":false},{"color":"red","italic":false,"obfuscated":true,"text":"ﷲ"}],"text":""}', '{"extra":[{"bold":false,"color":"yellow","italic":false,"obfuscated":false,"strikethrough":false,"text":"消耗性商品","underlined":false}],"text":""}'], food={can_always_eat:true, nutrition:2, saturation:3}, custom_name='{"text":"","extra":[{"text":"🥫 番茄酱","obfuscated":false,"italic":false,"underlined":false,"strikethrough":false,"color":"#F8312F","bold":false}]}', profile={id:[I;-1379669389,1531072490,-1573434766,-1255286997],name:"",properties:[{name:"textures",value:"eyJ0ZXh0dXJlcyI6eyJTS0lOIjp7InVybCI6Imh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvYzBiOGI1ODg5ZWUxYzYzODhkYzZjMmM1ZGJkNzBiNjk4NGFlZmU1NDMxOWEwOTVlNjRkYjc2MzgwOTdiODIxIn19fQ=="}]}, max_stack_size=1]`);
                runOpCommand(player, "execute if score %player_name% mcwws.data.offhand.remain matches 1 run minecraft:item replace entity %player_name% weapon.offhand with minecraft:air");
                //消除主手物品
                void itemInMainHand.setAmount(numMHI - 1);
                //清除状态效果
                runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:poison");
                runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:hunger");
                runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:slowness");
                runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:mining_fatigue");
                runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:nausea");
                runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:blindness");
                runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:darkness");
                //给予状态效果
                runOpCommand(player, "execute as %player_name% run effect give %player_name% minecraft:instant_health");
                runOpCommand(player, "execute as %player_name% run effect give %player_name% minecraft:resistance 300 1");
                runOpCommand(player, "execute as %player_name% run effect give %player_name% minecraft:night_vision 300");
                //给予玩家饥饿值和饱和度
                void player.setFoodLevel(OHFoodLevel + MHFoodLevel + playerFoodLevel);
                void player.setSaturation(OHSaturation + MHSaturation + playerSaturation);
                //主手物品剩余信息提示
                runOpCommand(player, `execute unless score %player_name% mcwws.data.offhand.remain matches 1 run minecraft:title %player_name% actionbar [{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"🧪 剩余 ","underlined":false},{"bold":false,"color":"#BFDD52","italic":false,"obfuscated":false,"strikethrough":false,"text":"%math_0_{objective_score_mcwws.data.offhand.remain}-1%","underlined":false},{"bold":false,"color":"dark_gray","italic":false,"obfuscated":false,"strikethrough":false,"text":"/32 ","underlined":false},{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"次使用","underlined":false}]`);
                runOpCommand(player, `execute if score %player_name% mcwws.data.offhand.remain matches 1 run minecraft:title %player_name% actionbar [{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"🧪 已耗尽","underlined":false}]`);
                //更新主手物品数据
                runOpCommand(player, "execute unless score %player_name% mcwws.data.offhand.remain matches 1 store result score %player_name% mcwws.data.offhand.remain run data get entity %player_name% Inventory[{Slot:-106b}].components.minecraft:custom_data.PublicBukkitValues.Remain");
                runOpCommand(player, "execute if score %player_name% mcwws.data.offhand.remain matches 1 run scoreboard players set %player_name% mcwws.data.offhand.remain 0");
                //播放音效
                runOpCommand(player, "playsound minecraft:item.honey_bottle.drink player %player_name% ~ ~ ~ 1 1 1");
                //恢复命令反馈
                runConsoleCommand("gamerule sendCommandFeedback true");
            }
            else {
                var OHIname = itemInOffHand.getItemMeta().getDisplayName();
                var OHSaturation = itemInOffHand.getItemMeta().getFood().getSaturation();
                var OHFoodLevel = itemInOffHand.getItemMeta().getFood().getNutrition();
                //独副
                //禁用命令反馈
                runConsoleCommand("gamerule sendCommandFeedback false");
                //更新主手物品
                runOpCommand(player, "execute store result score %player_name% mcwws.data.offhand.remain run data get entity %player_name% Inventory[{Slot:-106b}].components.minecraft:custom_data.PublicBukkitValues.Remain");
                runOpCommand(player, `execute unless score %player_name% mcwws.data.offhand.remain matches 1 run minecraft:item replace entity %player_name% weapon.offhand with minecraft:player_head[custom_data={PublicBukkitValues:{Remain:%math_0_{objective_score_mcwws.data.offhand.remain}-1%, "slimefun:slimefun_item": "MCWWS_KETCHUP"}}, lore=['{"extra":[{"bold":false,"color":"yellow","italic":false,"obfuscated":false,"strikethrough":false,"text":"","underlined":false}],"text":""}', '{"extra":[{"bold":false,"color":"green","italic":false,"obfuscated":false,"strikethrough":false,"text":"🍗 单次回复 ","underlined":false},{"color":"aqua","italic":false,"text":"2 "},{"color":"green","italic":false,"text":"饥饿值"}],"text":""}', '{"extra":[{"bold":false,"color":"green","italic":false,"obfuscated":false,"strikethrough":false,"text":"🍗 与","underlined":false},{"color":"green","italic":false,"text":"特定食物/饮品","underlined":true},{"color":"green","italic":false,"text":"搭配额外恢复 ","underlined":false},{"color":"aqua","italic":false,"text":"1 "},{"color":"green","italic":false,"text":"饥饿值 "},{"color":"dark_gray","italic":false,"text":"📘🔍"}],"text":""}', '{"extra":[{"bold":false,"color":"green","italic":false,"obfuscated":false,"strikethrough":false,"text":"☕ 增加 ","underlined":false},{"color":"aqua","italic":false,"text":"3 "},{"color":"green","italic":false,"text":"饱和度"}],"text":""}', '{"extra":[{"bold":false,"color":"#E066A2","italic":false,"obfuscated":false,"strikethrough":false,"text":"🫧 赋予/消除 ","underlined":false},{"bold":false,"color":"#E066DF","italic":false,"obfuscated":false,"strikethrough":false,"text":"状态效果","underlined":true},{"bold":false,"italic":false,"obfuscated":false,"strikethrough":false,"text":" ","underlined":false},{"color":"dark_gray","italic":false,"text":"📘🔍"}],"text":""}', '{"extra":[{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"🧪 剩余 ","underlined":false},{"bold":false,"color":"#BFDD52","italic":false,"obfuscated":false,"strikethrough":false,"text":"%math_0_{objective_score_mcwws.data.offhand.remain}-1%","underlined":false},{"bold":false,"color":"dark_gray","italic":false,"obfuscated":false,"strikethrough":false,"text":"/32 ","underlined":false},{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"次使用","underlined":false}],"text":""}', '{"extra":[{"bold":false,"color":"yellow","italic":false,"obfuscated":false,"strikethrough":false,"text":"","underlined":false}],"text":""}', '{"extra":[{"bold":false,"color":"gray","italic":false,"obfuscated":false,"strikethrough":false,"text":"🔒 已授权","underlined":false},{"color":"gray","italic":false,"obfuscated":true,"text":"ﷲ"}],"text":""}', '{"extra":[{"bold":false,"color":"red","italic":false,"obfuscated":false,"strikethrough":false,"text":"🚫🫳 不可放置","underlined":false},{"color":"red","italic":false,"obfuscated":true,"text":"ﷲ"}],"text":""}', '{"extra":[{"bold":false,"color":"red","italic":false,"obfuscated":false,"strikethrough":false,"text":"🚫📚 不可堆叠","underlined":false},{"color":"red","italic":false,"obfuscated":true,"text":"ﷲ"}],"text":""}', '{"extra":[{"bold":false,"color":"yellow","italic":false,"obfuscated":false,"strikethrough":false,"text":"消耗性商品","underlined":false}],"text":""}'], food={can_always_eat:true, nutrition:2, saturation:3}, custom_name='{"text":"","extra":[{"text":"🥫 番茄酱","obfuscated":false,"italic":false,"underlined":false,"strikethrough":false,"color":"#F8312F","bold":false}]}', profile={id:[I;-1379669389,1531072490,-1573434766,-1255286997],name:"",properties:[{name:"textures",value:"eyJ0ZXh0dXJlcyI6eyJTS0lOIjp7InVybCI6Imh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvYzBiOGI1ODg5ZWUxYzYzODhkYzZjMmM1ZGJkNzBiNjk4NGFlZmU1NDMxOWEwOTVlNjRkYjc2MzgwOTdiODIxIn19fQ=="}]}, max_stack_size=1]`);
                runOpCommand(player, "execute if score %player_name% mcwws.data.offhand.remain matches 1 run minecraft:item replace entity %player_name% weapon.offhand with minecraft:air");
                //清除状态效果
                runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:poison");
                runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:hunger");
                runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:slowness");
                runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:mining_fatigue");
                runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:nausea");
                runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:blindness");
                runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:darkness");
                //给予状态效果
                runOpCommand(player, "execute as %player_name% run effect give %player_name% minecraft:instant_health");
                runOpCommand(player, "execute as %player_name% run effect give %player_name% minecraft:resistance 300 1");
                runOpCommand(player, "execute as %player_name% run effect give %player_name% minecraft:night_vision 300");
                //给予玩家饥饿值和饱和度
                void player.setFoodLevel(OHFoodLevel + playerFoodLevel);
                void player.setSaturation(OHSaturation + playerSaturation);
                //主手物品剩余信息提示
                runOpCommand(player, `execute unless score %player_name% mcwws.data.offhand.remain matches 1 run minecraft:title %player_name% actionbar [{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"🧪 剩余 ","underlined":false},{"bold":false,"color":"#BFDD52","italic":false,"obfuscated":false,"strikethrough":false,"text":"%math_0_{objective_score_mcwws.data.offhand.remain}-1%","underlined":false},{"bold":false,"color":"dark_gray","italic":false,"obfuscated":false,"strikethrough":false,"text":"/32 ","underlined":false},{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"次使用","underlined":false}]`);
                runOpCommand(player, `execute if score %player_name% mcwws.data.offhand.remain matches 1 run minecraft:title %player_name% actionbar [{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"🧪 已耗尽","underlined":false}]`);
                //更新主手物品数据
                runOpCommand(player, "execute unless score %player_name% mcwws.data.offhand.remain matches 1 store result score %player_name% mcwws.data.offhand.remain run data get entity %player_name% Inventory[{Slot:-106b}].components.minecraft:custom_data.PublicBukkitValues.Remain");
                runOpCommand(player, "execute if score %player_name% mcwws.data.offhand.remain matches 1 run scoreboard players set %player_name% mcwws.data.offhand.remain 0");
                //播放音效
                runOpCommand(player, "playsound minecraft:item.honey_bottle.drink player %player_name% ~ ~ ~ 1 1 1");
                //恢复命令反馈
                runConsoleCommand("gamerule sendCommandFeedback true");
            }

        }
    }
    else {
        var OHIname = itemInOffHand.getItemMeta().getDisplayName();
        var OHSaturation = itemInOffHand.getItemMeta().getFood().getSaturation();
        var OHFoodLevel = itemInOffHand.getItemMeta().getFood().getNutrition();
        //独副
        //禁用命令反馈
        runConsoleCommand("gamerule sendCommandFeedback false");
        //更新主手物品
        runOpCommand(player, "execute store result score %player_name% mcwws.data.offhand.remain run data get entity %player_name% Inventory[{Slot:-106b}].components.minecraft:custom_data.PublicBukkitValues.Remain");
        runOpCommand(player, `execute unless score %player_name% mcwws.data.offhand.remain matches 1 run minecraft:item replace entity %player_name% weapon.offhand with minecraft:player_head[custom_data={PublicBukkitValues:{Remain:%math_0_{objective_score_mcwws.data.offhand.remain}-1%, "slimefun:slimefun_item": "MCWWS_KETCHUP"}}, lore=['{"extra":[{"bold":false,"color":"yellow","italic":false,"obfuscated":false,"strikethrough":false,"text":"","underlined":false}],"text":""}', '{"extra":[{"bold":false,"color":"green","italic":false,"obfuscated":false,"strikethrough":false,"text":"🍗 单次回复 ","underlined":false},{"color":"aqua","italic":false,"text":"2 "},{"color":"green","italic":false,"text":"饥饿值"}],"text":""}', '{"extra":[{"bold":false,"color":"green","italic":false,"obfuscated":false,"strikethrough":false,"text":"🍗 与","underlined":false},{"color":"green","italic":false,"text":"特定食物/饮品","underlined":true},{"color":"green","italic":false,"text":"搭配额外恢复 ","underlined":false},{"color":"aqua","italic":false,"text":"1 "},{"color":"green","italic":false,"text":"饥饿值 "},{"color":"dark_gray","italic":false,"text":"📘🔍"}],"text":""}', '{"extra":[{"bold":false,"color":"green","italic":false,"obfuscated":false,"strikethrough":false,"text":"☕ 增加 ","underlined":false},{"color":"aqua","italic":false,"text":"3 "},{"color":"green","italic":false,"text":"饱和度"}],"text":""}', '{"extra":[{"bold":false,"color":"#E066A2","italic":false,"obfuscated":false,"strikethrough":false,"text":"🫧 赋予/消除 ","underlined":false},{"bold":false,"color":"#E066DF","italic":false,"obfuscated":false,"strikethrough":false,"text":"状态效果","underlined":true},{"bold":false,"italic":false,"obfuscated":false,"strikethrough":false,"text":" ","underlined":false},{"color":"dark_gray","italic":false,"text":"📘🔍"}],"text":""}', '{"extra":[{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"🧪 剩余 ","underlined":false},{"bold":false,"color":"#BFDD52","italic":false,"obfuscated":false,"strikethrough":false,"text":"%math_0_{objective_score_mcwws.data.offhand.remain}-1%","underlined":false},{"bold":false,"color":"dark_gray","italic":false,"obfuscated":false,"strikethrough":false,"text":"/32 ","underlined":false},{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"次使用","underlined":false}],"text":""}', '{"extra":[{"bold":false,"color":"yellow","italic":false,"obfuscated":false,"strikethrough":false,"text":"","underlined":false}],"text":""}', '{"extra":[{"bold":false,"color":"gray","italic":false,"obfuscated":false,"strikethrough":false,"text":"🔒 已授权","underlined":false},{"color":"gray","italic":false,"obfuscated":true,"text":"ﷲ"}],"text":""}', '{"extra":[{"bold":false,"color":"red","italic":false,"obfuscated":false,"strikethrough":false,"text":"🚫🫳 不可放置","underlined":false},{"color":"red","italic":false,"obfuscated":true,"text":"ﷲ"}],"text":""}', '{"extra":[{"bold":false,"color":"red","italic":false,"obfuscated":false,"strikethrough":false,"text":"🚫📚 不可堆叠","underlined":false},{"color":"red","italic":false,"obfuscated":true,"text":"ﷲ"}],"text":""}', '{"extra":[{"bold":false,"color":"yellow","italic":false,"obfuscated":false,"strikethrough":false,"text":"消耗性商品","underlined":false}],"text":""}'], food={can_always_eat:true, nutrition:2, saturation:3}, custom_name='{"text":"","extra":[{"text":"🥫 番茄酱","obfuscated":false,"italic":false,"underlined":false,"strikethrough":false,"color":"#F8312F","bold":false}]}', profile={id:[I;-1379669389,1531072490,-1573434766,-1255286997],name:"",properties:[{name:"textures",value:"eyJ0ZXh0dXJlcyI6eyJTS0lOIjp7InVybCI6Imh0dHA6Ly90ZXh0dXJlcy5taW5lY3JhZnQubmV0L3RleHR1cmUvYzBiOGI1ODg5ZWUxYzYzODhkYzZjMmM1ZGJkNzBiNjk4NGFlZmU1NDMxOWEwOTVlNjRkYjc2MzgwOTdiODIxIn19fQ=="}]}, max_stack_size=1]`);
        runOpCommand(player, "execute if score %player_name% mcwws.data.offhand.remain matches 1 run minecraft:item replace entity %player_name% weapon.offhand with minecraft:air");
        //清除状态效果
        runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:poison");
        runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:hunger");
        runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:slowness");
        runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:mining_fatigue");
        runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:nausea");
        runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:blindness");
        runOpCommand(player, "execute as %player_name% run effect clear %player_name% minecraft:darkness");
        //给予状态效果
        runOpCommand(player, "execute as %player_name% run effect give %player_name% minecraft:instant_health");
        runOpCommand(player, "execute as %player_name% run effect give %player_name% minecraft:resistance 300 1");
        runOpCommand(player, "execute as %player_name% run effect give %player_name% minecraft:night_vision 300");
        //给予玩家饥饿值和饱和度
        void player.setFoodLevel(OHFoodLevel + playerFoodLevel);
        void player.setSaturation(OHSaturation + playerSaturation);
        //主手物品剩余信息提示
        runOpCommand(player, `execute unless score %player_name% mcwws.data.offhand.remain matches 1 run minecraft:title %player_name% actionbar [{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"🧪 剩余 ","underlined":false},{"bold":false,"color":"#BFDD52","italic":false,"obfuscated":false,"strikethrough":false,"text":"%math_0_{objective_score_mcwws.data.offhand.remain}-1%","underlined":false},{"bold":false,"color":"dark_gray","italic":false,"obfuscated":false,"strikethrough":false,"text":"/32 ","underlined":false},{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"次使用","underlined":false}]`);
        runOpCommand(player, `execute if score %player_name% mcwws.data.offhand.remain matches 1 run minecraft:title %player_name% actionbar [{"bold":false,"color":"#DD9352","italic":false,"obfuscated":false,"strikethrough":false,"text":"🧪 已耗尽","underlined":false}]`);
        //更新主手物品数据
        runOpCommand(player, "execute unless score %player_name% mcwws.data.offhand.remain matches 1 store result score %player_name% mcwws.data.offhand.remain run data get entity %player_name% Inventory[{Slot:-106b}].components.minecraft:custom_data.PublicBukkitValues.Remain");
        runOpCommand(player, "execute if score %player_name% mcwws.data.offhand.remain matches 1 run scoreboard players set %player_name% mcwws.data.offhand.remain 0");
        //播放音效
        runOpCommand(player, "playsound minecraft:item.honey_bottle.drink player %player_name% ~ ~ ~ 1 1 1");
        //恢复命令反馈
        runConsoleCommand("gamerule sendCommandFeedback true");
        runConsoleCommand("say %player_name%");
    }



    //var OHIname = itemInOffHand.getItemMeta().getDisplayName();
    //var OHSaturation = itemInOffHand.getItemMeta().getFood().getSaturation();
    //var OHFoodLevel = itemInOffHand.getItemMeta().getFood().getNutrition();







    //runOpCommand(player, "say " + numMHI);





}

//mcwws.data.offhand.remain
//if (OHIname == "§e土豆" || OHIname == "§e薯条") {}