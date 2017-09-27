<?
require($_SERVER["DOCUMENT_ROOT"]."/bitrix/header.php");
$APPLICATION->SetTitle("test");
?>Text here....<?$APPLICATION->IncludeComponent(
      "bitrix:menu.sections", "", 
      array( 
            "IS_SEF" => "Y", 
            "SEF_BASE_URL" => "/blog/", 
            "SECTION_PAGE_URL" => "#SECTION_ID#/", 
            "DETAIL_PAGE_URL" => "#SECTION_ID#/#ELEMENT_ID#.html", 
            "IBLOCK_TYPE" => "company", 
            "IBLOCK_ID" => "2", 
            "DEPTH_LEVEL" => "1", 
            "CACHE_TYPE" => "A", 
            "CACHE_TIME" => "36000000" 
            ), 
            false 
            ); ?><?require($_SERVER["DOCUMENT_ROOT"]."/bitrix/footer.php");?>